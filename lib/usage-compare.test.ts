import { rateCalls, type RatedRow } from "./usage-compare";

const row = (id: number, tokens: number, latencyMs: number): RatedRow => ({
  id,
  input_tokens: tokens - 100,
  output_tokens: 100,
  latency_ms: latencyMs,
});

// Medians: 400 total tokens, 1000 ms.
const base = [
  row(1, 300, 800),
  row(2, 400, 1000),
  row(3, 500, 1200),
  row(4, 400, 900),
  row(5, 400, 1100),
];

describe("rateCalls", () => {
  it("rates nothing until five rows have usage", () => {
    const result = rateCalls(base.slice(0, 4));
    expect(result.ratings.size).toBe(0);
    expect(result.rated).toBe(0);
  });

  it("marks calls at or below the median on both tokens and latency as efficient", () => {
    const { ratings } = rateCalls(base);
    expect(ratings.get(1)).toBe("efficient");
    expect(ratings.get(2)).toBe("efficient");
    expect(ratings.get(3)).toBeUndefined();
  });

  it("marks a call over 1.5 times the median tokens or latency as problematic", () => {
    const rows = [...base, row(6, 700, 900), row(7, 400, 1700)];
    const { ratings } = rateCalls(rows);
    expect(ratings.get(6)).toBe("problematic");
    expect(ratings.get(7)).toBe("problematic");
  });

  it("skips rows with missing usage and reports the medians", () => {
    const old = { id: 9, input_tokens: null, output_tokens: null, latency_ms: null };
    const result = rateCalls([...base, old]);
    expect(result.ratings.has(9)).toBe(false);
    expect(result.rated).toBe(5);
    expect(result.medianTokens).toBe(400);
    expect(result.medianLatencyMs).toBe(1000);
  });
});
