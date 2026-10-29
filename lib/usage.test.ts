import { UsageSchema, toUsage } from "./usage";

describe("toUsage", () => {
  it("keeps only input tokens, output tokens and latency", () => {
    const usage = toUsage({
      model: "claude-haiku-5-5",
      inputTokens: 120,
      outputTokens: 160,
      cacheRead: 5,
      cacheWrite: 7,
      stopReason: "end_turn",
      latencyMs: 842,
    });
    expect(usage).toEqual({ inputTokens: 120, outputTokens: 160, latencyMs: 842 });
  });
});

describe("UsageSchema", () => {
  it.each([
    [{ inputTokens: -1, outputTokens: 1, latencyMs: 1 }],
    [{ inputTokens: 1.5, outputTokens: 1, latencyMs: 1 }],
    [{ inputTokens: 1, outputTokens: "2", latencyMs: 1 }],
    [{ inputTokens: 1, outputTokens: 1 }],
  ])("rejects %j", (bad) => {
    expect(UsageSchema.safeParse(bad).success).toBe(false);
  });
});
