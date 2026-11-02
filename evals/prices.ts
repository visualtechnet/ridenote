/**
 * List prices per million tokens, Anthropic first-party API, taken from the Claude API reference on
 * PRICES_AS_OF. Only used to turn an eval run's token counts into a cost figure; the bill is the truth.
 * Haiku 5.5's prices are for prompts up to 100K tokens, which every parse is by a wide margin.
 */
export const PRICES_AS_OF = "2026-10-06";

export const PRICES: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "claude-haiku-5-5": { inputPerMillion: 0.1, outputPerMillion: 0.5 },
  "claude-sonnet-5-5": { inputPerMillion: 2, outputPerMillion: 10 },
};

/** Dollars for the tokens given; 0 for a model with no price here, so a run never pretends. */
export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model];
  if (!price) return 0;
  return (inputTokens * price.inputPerMillion + outputTokens * price.outputPerMillion) / 1_000_000;
}
