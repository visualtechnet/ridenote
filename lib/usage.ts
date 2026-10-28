import { z } from "zod";
import type { CallMeta } from "./extract";

/** What the person sees about one parse: how much it used and how long it took. */
export const UsageSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  latencyMs: z.number().int().min(0),
});

export type Usage = z.infer<typeof UsageSchema>;

/** The public part of a call's meta. Model, stop reason and cache counts stay in the server log. */
export function toUsage(meta: CallMeta): Usage {
  return {
    inputTokens: meta.inputTokens,
    outputTokens: meta.outputTokens,
    latencyMs: meta.latencyMs,
  };
}
