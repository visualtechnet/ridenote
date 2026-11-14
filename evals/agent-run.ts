import { RIDERS } from "../lib/agent/riders";
import { runAgent } from "../lib/agent/loop";
import type { AgentModel, RunResult, ToolContext } from "../lib/agent/types";
import type { Trip } from "../lib/trip";
import type { AgentCase } from "./agent-cases";
import type { AgentRow } from "./agent-results";
import { checkedVehicle, scorePath } from "./agent-score";
import { CLOCK } from "./cases";

export type CaseDeps = {
  parse: (
    note: string,
  ) => Promise<
    | { ok: true; trip: Trip; inputTokens: number; outputTokens: number }
    | { ok: false; error: string }
  >;
  model: AgentModel;
};

export type Attempted = {
  problems: string[];
  row: Pick<
    AgentRow,
    | "ended"
    | "steps"
    | "tools"
    | "checkedVehicle"
    | "inputTokens"
    | "outputTokens"
    | "cacheRead"
    | "latencyMs"
  >;
};

/** An invented signing key for fixtures; it never signs anything real. */
const FIXTURE_SECRET = "eval-fixture-secret-".repeat(2);

const emptyRow: Attempted["row"] = {
  ended: "",
  steps: 0,
  tools: [],
  checkedVehicle: false,
  inputTokens: 0,
  outputTokens: 0,
  cacheRead: 0,
  latencyMs: 0,
};

/** True once spending is past the limit; a run that lands exactly on it may still go on. */
export function overBudget(spent: number, max: number): boolean {
  return spent > max;
}

const firstLine = (err: unknown) =>
  err instanceof Error ? err.message.split("\n")[0] : "unknown error";

/** One run of one case: parse the note, run the agent, score the path. Never throws. */
export async function runAgentCase(deps: CaseDeps, c: AgentCase): Promise<Attempted> {
  const started = performance.now();
  let parsed;
  try {
    parsed = await deps.parse(c.note);
  } catch (err) {
    return {
      problems: [`parse failed: ${firstLine(err)}`],
      row: {
        ...emptyRow,
        ended: "parse failed",
        latencyMs: Math.round(performance.now() - started),
      },
    };
  }
  if (!parsed.ok) {
    return {
      problems: [`parse failed: ${parsed.error}`],
      row: {
        ...emptyRow,
        ended: "parse failed",
        latencyMs: Math.round(performance.now() - started),
      },
    };
  }

  let ids = 0;
  const ctx: ToolContext = {
    clock: CLOCK,
    note: c.note,
    parsed: parsed.trip,
    riders: RIDERS,
    secret: FIXTURE_SECRET,
    runId: `eval-${c.name}`,
    newId: () => `draft-${++ids}`,
  };

  let result: RunResult;
  try {
    result = await runAgent({ model: deps.model, ctx });
  } catch (err) {
    return {
      problems: [`run threw: ${firstLine(err)}`],
      row: {
        ...emptyRow,
        ended: "failed: upstream",
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
        latencyMs: Math.round(performance.now() - started),
      },
    };
  }

  return {
    problems: scorePath(result, c.expect),
    row: {
      ended: result.status === "failed" ? `failed: ${result.reason}` : result.status,
      steps: result.steps.length,
      tools: result.steps.flatMap((s) => s.calls.map((call) => call.name)),
      checkedVehicle: checkedVehicle(result),
      inputTokens: parsed.inputTokens + result.usage.inputTokens,
      outputTokens: parsed.outputTokens + result.usage.outputTokens,
      cacheRead: result.usage.cacheRead,
      latencyMs: Math.round(performance.now() - started),
    },
  };
}
