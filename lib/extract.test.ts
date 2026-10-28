/** @jest-environment node */

import { HTTP, UPSTREAM } from "./config";
import { extractTrip } from "./extract";
import { jsonContent } from "@/tests/model-reply";

const goodTrip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
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

function clientReturning(res: Record<string, unknown>) {
  return { messages: { create: jest.fn().mockResolvedValue(res) } } as never;
}

describe("extractTrip meta", () => {
  it("reports tokens, stop reason, model and latency on success", async () => {
    const result = await extractTrip(
      clientReturning({ stop_reason: "end_turn", content: jsonContent(goodTrip), usage: USAGE }),
      "note",
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
    );
    expect(result).toMatchObject({ ok: false, status: HTTP.unprocessable });
    expect(result.meta.stopReason).toBe("refusal");
  });

  it("still reports meta when the answer is cut off at max_tokens", async () => {
    const result = await extractTrip(
      clientReturning({ stop_reason: "max_tokens", content: [], usage: USAGE }),
      "note",
    );
    expect(result).toMatchObject({ ok: false, status: HTTP.badGateway });
    expect(result.meta.outputTokens).toBe(160);
  });

  it("still reports meta when the output fails validation", async () => {
    const result = await extractTrip(
      clientReturning({ stop_reason: "end_turn", content: jsonContent({ nope: 1 }), usage: USAGE }),
      "note",
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
    );
    expect(result).toMatchObject({ ok: false, status: HTTP.badGateway });
    expect(result.meta.outputTokens).toBe(160);
  });

  it("keeps the usage when the reply has no text block at all", async () => {
    const result = await extractTrip(
      clientReturning({ stop_reason: "end_turn", content: [], usage: USAGE }),
      "note",
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
    );
    expect(result.ok).toBe(true);
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
    );
    expect(result.meta).toMatchObject({ cacheRead: 0, cacheWrite: 0 });
  });
});
