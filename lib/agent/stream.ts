import type { Trip } from "../trip";
import type { StreamEvent } from "../stream-events";
import type { RunResult, StepRecord } from "./types";

export type { StreamEvent } from "../stream-events";

export function parsedEvent(trip: Trip): StreamEvent {
  return { type: "parsed", trip };
}

export function stepEvent(record: StepRecord): StreamEvent {
  return {
    type: "step",
    step: record.step,
    stopReason: record.stopReason,
    calls: record.calls.map(({ name, content, is_error }) => ({ name, is_error, content })),
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    ms: record.ms,
  };
}

/** The last event of a run: the same ending the loop returned, with its usage. */
export function endedEvent(result: RunResult): StreamEvent {
  if (result.status === "proposed") {
    const { draftId, draft, merged } = result.end;
    return { type: "ended", status: "proposed", draftId, draft, merged, usage: result.usage };
  }
  if (result.status === "needs_info") {
    const { question, options, resume } = result.end;
    return {
      type: "ended",
      status: "needs_info",
      question,
      options,
      resume,
      usage: result.usage,
    };
  }
  return { type: "ended", status: "failed", reason: result.reason, usage: result.usage };
}

/** One NDJSON line, newline included. */
export function encodeLine(event: StreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}
