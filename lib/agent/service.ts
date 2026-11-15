import { AGENT } from "../config";
import type { Clock } from "../clock";
import type { Extraction } from "../extract";
import type { AskOption } from "./ask-dispatcher";
import type { ResumePayload } from "./ask-dispatcher";
import { runAgent } from "./loop";
import { endedEvent, parsedEvent, stepEvent, type StreamEvent } from "./stream";
import { withStepTimeout } from "./step-timeout";
import type { AgentModel, Rider, ToolContext } from "./types";

/** The parse step: one model call that turns the note into a checked trip. Injected so tests skip the API. */
export type ParseStep = (note: string, clock: Clock, signal: AbortSignal) => Promise<Extraction>;

export type ServiceDeps = {
  parse: ParseStep;
  model: AgentModel;
  secret: string;
  riders: readonly Rider[];
  newId: () => string;
  newRunId: () => string;
  signal: AbortSignal;
  /** Receives each event in order. Must not throw; a throw is caught and ends the run as failed. */
  emit: (event: StreamEvent) => void;
};

/** The model for one step: its own time limit and one retry (AGENT.stepMs, AGENT.stepRetries). */
function timedModel(model: AgentModel): AgentModel {
  return withStepTimeout(model, { stepMs: AGENT.stepMs, retries: AGENT.stepRetries });
}

/** Runs a new note: parse, then the loop. Every outcome ends with one `ended` event. */
export async function runNote(deps: ServiceDeps, note: string, clock: Clock): Promise<void> {
  const runId = deps.newRunId();
  deps.emit({ type: "run_started", runId });
  try {
    const parsed = await deps.parse(note, clock, deps.signal);
    if (!parsed.ok) {
      deps.emit({ type: "error", code: "parse_failed" });
      deps.emit({ type: "ended", status: "failed", reason: "upstream", usage: zeroUsage() });
      return;
    }
    deps.emit(parsedEvent(parsed.trip));
    const ctx: ToolContext = {
      clock,
      note,
      parsed: parsed.trip,
      riders: deps.riders,
      secret: deps.secret,
      runId,
      newId: deps.newId,
    };
    await finish(deps, ctx, []);
  } catch {
    // Nothing from a failed step is shown beyond the error kind: its message could carry the note.
    deps.emit({ type: "error", code: "unavailable" });
    deps.emit({ type: "ended", status: "failed", reason: "upstream", usage: zeroUsage() });
  }
}

/**
 * Continues after the dispatcher answered an `ask_dispatcher` question. The signed token gives the
 * parsed trip and the offered option, so nothing is parsed again. The rider the dispatcher chose is
 * already known to be real (the server offered it from a search), so the model may propose it
 * without searching again.
 */
export async function runResume(
  deps: ServiceDeps,
  payload: ResumePayload,
  option: AskOption,
  clock: Clock,
): Promise<void> {
  const runId = deps.newRunId();
  deps.emit({ type: "run_started", runId });
  deps.emit(parsedEvent(payload.parsed));
  const ctx: ToolContext = {
    clock,
    note: resumeNote(payload, option),
    parsed: payload.parsed,
    riders: deps.riders,
    secret: deps.secret,
    runId,
    newId: deps.newId,
  };
  try {
    await finish(deps, ctx, option.rider_id === null ? [] : [option.rider_id]);
  } catch {
    deps.emit({ type: "error", code: "unavailable" });
    deps.emit({ type: "ended", status: "failed", reason: "upstream", usage: zeroUsage() });
  }
}

/**
 * The text the model reads on resume. It is built only from the signed question, the offered label,
 * the rider id and the checked date and time, never from the dispatcher's note.
 */
export function resumeNote(payload: ResumePayload, option: AskOption): string {
  const rider =
    option.rider_id === null ? "No rider id was chosen." : `Rider id: ${option.rider_id}.`;
  return [
    `The dispatcher answered "${payload.question}" with "${option.label}".`,
    rider,
    `Pickup date ${payload.parsed.pickup_date ?? "unknown"}, pickup time ${payload.parsed.pickup_time ?? "unknown"}.`,
    "Propose the trip if the answer is enough. Otherwise ask again.",
  ].join(" ");
}

async function finish(deps: ServiceDeps, ctx: ToolContext, knownRiderIds: string[]) {
  const result = await runAgent({
    model: timedModel(deps.model),
    ctx,
    signal: deps.signal,
    knownRiderIds,
    onStep: (record) => deps.emit(stepEvent(record)),
  });
  deps.emit(endedEvent(result));
}

function zeroUsage() {
  return { steps: 0, inputTokens: 0, outputTokens: 0, cacheRead: 0, latencyMs: 0 };
}
