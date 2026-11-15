import { makeTrip } from "../../tests/test-utils";
import { endedEvent, encodeLine, parsedEvent, stepEvent } from "./stream";
import type { RunResult, StepRecord } from "./types";

const usage = { steps: 2, inputTokens: 10, outputTokens: 5, cacheRead: 0, latencyMs: 40 };
const record: StepRecord = {
  step: 1,
  stopReason: "tool_use",
  calls: [{ name: "find_rider", input: { name: "Jo" }, content: '{"riders":[]}', is_error: false }],
  inputTokens: 10,
  outputTokens: 5,
  cacheRead: 0,
  ms: 7,
};

describe("stream events", () => {
  it("sends a step with tool names, results and numbers, never the tool input", () => {
    const event = stepEvent(record);
    expect(event).toEqual({
      type: "step",
      step: 1,
      stopReason: "tool_use",
      calls: [{ name: "find_rider", is_error: false, content: '{"riders":[]}' }],
      inputTokens: 10,
      outputTokens: 5,
      ms: 7,
    });
    expect(JSON.stringify(event)).not.toContain('"Jo"');
  });

  it("sends the parsed trip as its own event", () => {
    expect(parsedEvent(makeTrip({ passenger_name: "Jo" }))).toEqual({
      type: "parsed",
      trip: makeTrip({ passenger_name: "Jo" }),
    });
  });

  it("ends a proposed run with the draft and the merged trip", () => {
    const merged = {
      trip: makeTrip(),
      sources: { pickup: "note" as const, mobility: "none" as const },
      conflicts: [] as "mobility"[],
    };
    const result: RunResult = {
      status: "proposed",
      usage,
      steps: [],
      end: { status: "proposed", draftId: "d1", draft: "tok", merged },
    };
    expect(endedEvent(result)).toEqual({
      type: "ended",
      status: "proposed",
      draftId: "d1",
      draft: "tok",
      merged,
      usage,
    });
  });

  it("ends a question with its options and resume token", () => {
    const result: RunResult = {
      status: "needs_info",
      usage,
      steps: [],
      end: {
        status: "needs_info",
        question: "Which?",
        options: [{ label: "A", rider_id: "r1" }],
        resume: "res",
      },
    };
    expect(endedEvent(result)).toEqual({
      type: "ended",
      status: "needs_info",
      question: "Which?",
      options: [{ label: "A", rider_id: "r1" }],
      resume: "res",
      usage,
    });
  });

  it("ends a failed run with its reason and no draft", () => {
    const event = endedEvent({ status: "failed", reason: "deadline", usage, steps: [] });
    expect(event).toEqual({ type: "ended", status: "failed", reason: "deadline", usage });
    expect(JSON.stringify(event)).not.toContain("draft");
  });

  it("writes one JSON line with a newline at the end", () => {
    const line = encodeLine({ type: "run_started", runId: "run-1" });
    expect(line).toBe('{"type":"run_started","runId":"run-1"}\n');
  });
});
