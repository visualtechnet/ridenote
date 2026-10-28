import { USAGE_RATING } from "./config";

export type RatedRow = {
  id: number;
  input_tokens?: number | null;
  output_tokens?: number | null;
  latency_ms?: number | null;
};

export type Rating = "efficient" | "problematic";

export type Comparison = {
  ratings: Map<number, Rating>;
  /** How many rows had usage and took part. */
  rated: number;
  medianTokens: number;
  medianLatencyMs: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Rates each call against the others in the list: efficient when total tokens and latency are both
 * at or below the median, problematic when either is over the median by USAGE_RATING.problematicFactor.
 * Rows saved before usage existed are skipped. The ratings are relative: a long note will always use
 * more tokens than a short one.
 */
export function rateCalls(rows: RatedRow[]): Comparison {
  const usable = rows.flatMap((r) =>
    r.input_tokens != null && r.output_tokens != null && r.latency_ms != null
      ? [{ id: r.id, tokens: r.input_tokens + r.output_tokens, latency: r.latency_ms }]
      : [],
  );
  const ratings = new Map<number, Rating>();
  if (usable.length < USAGE_RATING.minRows) {
    return { ratings, rated: 0, medianTokens: 0, medianLatencyMs: 0 };
  }
  const medianTokens = median(usable.map((u) => u.tokens));
  const medianLatencyMs = median(usable.map((u) => u.latency));
  const limit = USAGE_RATING.problematicFactor;
  for (const u of usable) {
    if (u.tokens > medianTokens * limit || u.latency > medianLatencyMs * limit) {
      ratings.set(u.id, "problematic");
    } else if (u.tokens <= medianTokens && u.latency <= medianLatencyMs) {
      ratings.set(u.id, "efficient");
    }
  }
  return { ratings, rated: usable.length, medianTokens, medianLatencyMs };
}
