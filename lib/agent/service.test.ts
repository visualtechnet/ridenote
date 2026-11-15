import { makeTrip } from "../../tests/test-utils";
import { runNote, runResume, resumeNote, type ServiceDeps } from "./service";
import { scriptedModel, textReply, toolReply } from "./test-model";
import type { StreamEvent } from "./stream";
import { testContext } from "./test-context";
import { RIDERS } from "./riders";
import type { ResumePayload } from "./ask-dispatcher";

const CLOCK = { now: new Date("2026-11-02T15:00:00Z"), timeZone: "America/New_York" };
const ok = (trip = makeTrip({ pickup_date: "2026-11-03" })) => ({
  ok: true as const,
  trip,
  meta: {
    model: "m",
    inputTokens: 1,
    outputTokens: 1,
    cacheRead: 0,
    cacheWrite: 0,
    stopReason: "end_turn",
    latencyMs: 1,
  },
});

function deps(over: Partial<ServiceDeps> = {}) {
  const events: StreamEvent[] = [];
  const base: ServiceDeps = {
    parse: async () => ok(),
    model: scriptedModel([]),
    secret: testContext().secret,
    riders: RIDERS,
    newId: () => "draft-1",
    newRunId: () => "run-1",
    signal: new AbortController().signal,
    emit: (e) => events.push(e),
    ...over,
  };
  return { deps: base, events };
}

describe("runNote", () => {
  it("streams run_started, parsed, a step and a proposal, in that order", async () => {
    const model = scriptedModel([
      toolReply([{ name: "find_rider", input: { name: "James O'Neil" } }]),
      toolReply([
        {
          name: "propose_trip",
          input: { rider_id: "r3", pickup_date: "2026-11-03", pickup_time: "09:00", reasons: [] },
        },
      ]),
    ]);
    const { deps: d, events } = deps({
      model,
      parse: async () =>
        ok(
          makeTrip({
            passenger_name: "James O'Neil",
            pickup_date: "2026-11-03",
            pickup_time: "09:00",
            dropoff_location: "County Hospital",
          }),
        ),
    });
    await runNote(d, "James to County Hospital tomorrow at 9am", CLOCK);
    expect(events.map((e) => e.type)).toEqual(["run_started", "parsed", "step", "step", "ended"]);
    expect(events.at(-1)).toMatchObject({ type: "ended", status: "proposed", draftId: "draft-1" });
  });

  it("reports a parse failure as an error and a failed run, with no model call", async () => {
    const model = scriptedModel([]);
    const { deps: d, events } = deps({
      model,
      parse: async () => ({ ok: false, status: 502, error: "x", meta: ok().meta }),
    });
    await runNote(d, "anything", CLOCK);
    expect(events.map((e) => e.type)).toEqual(["run_started", "error", "ended"]);
    expect(events.at(-1)).toMatchObject({ status: "failed", reason: "upstream" });
    expect(model.calls).toBe(0);
  });

  it("turns an unexpected throw into a generic error, without its message", async () => {
    const { deps: d, events } = deps({
      parse: async () => {
        throw new Error("secret detail about the note");
      },
    });
    await runNote(d, "anything", CLOCK);
    expect(events).toEqual([
      { type: "run_started", runId: "run-1" },
      { type: "error", code: "unavailable" },
      { type: "ended", status: "failed", reason: "upstream", usage: expect.any(Object) },
    ]);
    expect(JSON.stringify(events)).not.toContain("secret detail");
  });
});

describe("runResume", () => {
  const payload: ResumePayload = {
    v: 1,
    kind: "resume",
    run_id: "run-0",
    parsed: makeTrip({ pickup_date: "2026-11-03", pickup_time: "09:00" }),
    question: "Which Maria?",
    options: [{ label: "María López, 12 Elm St", rider_id: "r1" }],
    exp: Date.now() + 60_000,
  };

  it("proposes the chosen rider without searching again", async () => {
    const model = scriptedModel([
      toolReply([
        {
          name: "propose_trip",
          input: { rider_id: "r1", pickup_date: "2026-11-03", pickup_time: "09:00", reasons: [] },
        },
      ]),
    ]);
    const { deps: d, events } = deps({ model });
    await runResume(d, payload, payload.options[0], CLOCK);
    expect(events.map((e) => e.type)).toEqual(["run_started", "parsed", "step", "ended"]);
    expect(events.at(-1)).toMatchObject({ status: "proposed" });
  });

  it("ends as failed when the model throws during resume", async () => {
    const model = scriptedModel([new Error("boom")]);
    const { deps: d, events } = deps({ model });
    await runResume(d, payload, payload.options[0], CLOCK);
    // The loop turns a failed model call into a named failure, so it is not an unexpected error.
    expect(events.some((e) => e.type === "error")).toBe(false);
    expect(events.at(-1)).toMatchObject({ status: "failed", reason: "upstream" });
  });

  it("builds the resume note from the signed answer only", () => {
    const text = resumeNote(payload, payload.options[0]);
    expect(text).toContain('answered "Which Maria?"');
    expect(text).toContain("Rider id: r1.");
    expect(text).toContain("Pickup date 2026-11-03, pickup time 09:00.");
    expect(resumeNote(payload, { label: "Someone else", rider_id: null })).toContain(
      "No rider id was chosen.",
    );
  });

  it("uses the model's reply text without a tool call as a failure", async () => {
    const { deps: d, events } = deps({ model: scriptedModel([textReply("hm")]) });
    await runResume(d, payload, payload.options[0], CLOCK);
    expect(events.at(-1)).toMatchObject({ status: "failed" });
  });
});
