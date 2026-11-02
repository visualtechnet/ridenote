/** @jest-environment node */

import { HTTP, OUTPUT_LIMITS, UPSTREAM } from "./config";
import { extractTrip } from "./extract";
import { jsonContent } from "@/tests/model-reply";

const goodTrip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
  pickup_date: null,
  pickup_time: "09:30",
  mobility: ["wheelchair"],
  notes: "",
};

const USAGE = {
  input_tokens: 120,
  output_tokens: 160,
  cache_read_input_tokens: 5,
  cache_creation_input_tokens: 7,
};

// Monday 2026-11-02, 10:00 in New York.
const clock = { now: new Date("2026-11-02T15:00:00Z"), timeZone: "America/New_York" };

function clientReturning(res: Record<string, unknown>) {
  return { messages: { create: jest.fn().mockResolvedValue(res) } } as never;
}

describe("extractTrip meta", () => {
  it("reports tokens, stop reason, model and latency on success", async () => {
    const result = await extractTrip(
      clientReturning({ stop_reason: "end_turn", content: jsonContent(goodTrip), usage: USAGE }),
      "note",
      { clock },
    );
    expect(result.ok).toBe(true);
    expect(result.meta).toEqual({
      model: UPSTREAM.defaultModel,
      inputTokens: 120,
      outputTokens: 160,
      cacheRead: 5,
      cacheWrite: 7,
      stopReason: "end_turn",
      latencyMs: expect.any(Number),
    });
  });

  it("still reports meta when the model refuses", async () => {
    const result = await extractTrip(
      clientReturning({ stop_reason: "refusal", content: [], usage: USAGE }),
      "note",
      { clock },
    );
    expect(result).toMatchObject({ ok: false, status: HTTP.unprocessable });
    expect(result.meta.stopReason).toBe("refusal");
  });

  it("still reports meta when the answer is cut off at max_tokens", async () => {
    const result = await extractTrip(
      clientReturning({ stop_reason: "max_tokens", content: [], usage: USAGE }),
      "note",
      { clock },
    );
    expect(result).toMatchObject({ ok: false, status: HTTP.badGateway });
    expect(result.meta.outputTokens).toBe(160);
  });

  it("still reports meta when the output fails validation", async () => {
    const result = await extractTrip(
      clientReturning({ stop_reason: "end_turn", content: jsonContent({ nope: 1 }), usage: USAGE }),
      "note",
      { clock },
    );
    expect(result).toMatchObject({ ok: false, status: HTTP.badGateway });
    expect(result.meta.inputTokens).toBe(120);
  });

  it.each([
    ["truncated JSON", '{"passenger_name": "Mrs. Le'],
    ["plain prose", "Sorry, I could not read that."],
    ["an empty string", ""],
  ])("keeps the usage when the text is %s instead of throwing", async (_label, text) => {
    const result = await extractTrip(
      clientReturning({
        stop_reason: "max_tokens",
        content: [{ type: "text", text }],
        usage: USAGE,
      }),
      "note",
      { clock },
    );
    expect(result).toMatchObject({ ok: false, status: HTTP.badGateway });
    expect(result.meta).toMatchObject({ outputTokens: 160, stopReason: "max_tokens" });
  });

  it("keeps the usage when an end_turn answer is not JSON", async () => {
    const result = await extractTrip(
      clientReturning({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "not json at all" }],
        usage: USAGE,
      }),
      "note",
      { clock },
    );
    expect(result).toMatchObject({ ok: false, status: HTTP.badGateway });
    expect(result.meta.outputTokens).toBe(160);
  });

  it("keeps the usage when the reply has no text block at all", async () => {
    const result = await extractTrip(
      clientReturning({ stop_reason: "end_turn", content: [], usage: USAGE }),
      "note",
      { clock },
    );
    expect(result).toMatchObject({ ok: false, status: HTTP.badGateway });
    expect(result.meta.inputTokens).toBe(120);
  });

  it("reads the first text block when thinking blocks come first", async () => {
    const result = await extractTrip(
      clientReturning({
        stop_reason: "end_turn",
        content: [{ type: "thinking", thinking: "hmm" }, ...jsonContent(goodTrip)],
        usage: USAGE,
      }),
      "note",
      { clock },
    );
    expect(result.ok).toBe(true);
  });

  it("sends today's date in the dispatcher's zone with the instructions", async () => {
    const client = clientReturning({
      stop_reason: "end_turn",
      content: jsonContent(goodTrip),
      usage: USAGE,
    });
    await extractTrip(client, "note", { clock });
    const params = (client as { messages: { create: jest.Mock } }).messages.create.mock.calls[0][0];
    expect(params.system).toContain("Today is Monday, 2026-11-02 (America/New_York).");
  });

  it("logs missing cache counts as 0, not null", async () => {
    const result = await extractTrip(
      clientReturning({
        stop_reason: "end_turn",
        content: jsonContent(goodTrip),
        usage: {
          input_tokens: 1,
          output_tokens: 2,
          cache_read_input_tokens: null,
          cache_creation_input_tokens: null,
        },
      }),
      "note",
      { clock },
    );
    expect(result.meta).toMatchObject({ cacheRead: 0, cacheWrite: 0 });
  });
});

describe("extractTrip checks the date in code", () => {
  const dated = (pickup_date: string | null, notes = "") => ({
    stop_reason: "end_turn",
    content: jsonContent({ ...goodTrip, pickup_date, notes }),
    usage: USAGE,
  });

  it("keeps a date that is real, in the window and on the named weekday", async () => {
    const result = await extractTrip(clientReturning(dated("2026-11-06")), "Friday 9:30am", {
      clock,
    });
    expect(result.ok && result.trip.pickup_date).toBe("2026-11-06");
    expect(result.ok && result.trip.notes).toBe("");
  });

  it("clears a date that has passed and puts the reason first in notes", async () => {
    const result = await extractTrip(
      clientReturning(dated("2026-10-01", "Approximate time.")),
      "On 10/1 at 9:30am",
      { clock },
    );
    expect(result.ok && result.trip).toMatchObject({
      pickup_date: null,
      notes: "Date Thu, Oct 1, 2026 has already passed; confirm the date. Approximate time.",
    });
  });

  it("clears a date on the wrong weekday", async () => {
    const result = await extractTrip(clientReturning(dated("2026-11-05")), "Friday 11/5 at 9am", {
      clock,
    });
    expect(result.ok && result.trip).toMatchObject({
      pickup_date: null,
      notes: "Note says Friday but Thu, Nov 5, 2026 is a Thursday; confirm the date.",
    });
  });

  it("does not add the date to missing_fields: a missing date is never a Missing chip", async () => {
    const result = await extractTrip(clientReturning(dated(null)), "note", { clock });
    expect(result.ok && result.trip.missing_fields).toEqual([]);
    const cleared = await extractTrip(clientReturning(dated("2026-10-01")), "note", { clock });
    expect(cleared.ok && cleared.trip.missing_fields).toEqual([]);
  });

  it("keeps notes within the limit when a reason is added to a long line", async () => {
    const long = "x".repeat(OUTPUT_LIMITS.notes);
    const result = await extractTrip(clientReturning(dated("2026-10-01", long)), "note", { clock });
    expect(result.ok && result.trip.notes.length).toBeLessThanOrEqual(OUTPUT_LIMITS.notes);
    expect(
      result.ok && result.trip.notes.startsWith("Date Thu, Oct 1, 2026 has already passed"),
    ).toBe(true);
  });

  it("rejects a date in the wrong shape as a bad answer, like a bad time", async () => {
    const result = await extractTrip(clientReturning(dated("11/06/2026")), "note", { clock });
    expect(result).toMatchObject({ ok: false, status: HTTP.badGateway });
  });
});

describe("extractTrip thinking setting", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  const reply = { stop_reason: "end_turn", content: jsonContent(goodTrip), usage: USAGE };

  it("sends the thinking setting that fits the model", async () => {
    delete process.env.MODEL;
    const haiku = jest.fn().mockResolvedValue(reply);
    await extractTrip({ messages: { create: haiku } } as never, "note", { clock });
    expect(haiku.mock.calls[0][0].thinking).toEqual({ type: "disabled" });

    process.env.MODEL = "claude-sonnet-5-5";
    const sonnet = jest.fn().mockResolvedValue(reply);
    await extractTrip({ messages: { create: sonnet } } as never, "note", { clock });
    expect(sonnet.mock.calls[0][0].thinking).toEqual({ type: "between_tools" });
  });
});
