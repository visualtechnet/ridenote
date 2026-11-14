import type Anthropic from "@anthropic-ai/sdk";
import { executeToolCalls } from "./execute";
import type { StepRecord, ToolContext } from "./types";

export type ReplayMismatch = { step: number; call: number; recorded: string; replayed: string };

/**
 * Re-runs every recorded tool call in order against the same context and one shared set of seen
 * rider ids, and lists each call whose result differs. Draft tokens are deterministic for the same
 * clock and newId, so a faithful run matches. `ctx.newId` must return the recorded draft id (for
 * example a fixed id, as `testContext` does); otherwise every `propose_trip` result differs. Never throws on odd records.
 */
export function replayRun(
  records: StepRecord[],
  ctx: ToolContext,
): { ok: boolean; mismatches: ReplayMismatch[] } {
  const seenRiderIds = new Set<string>();
  const mismatches: ReplayMismatch[] = [];
  for (const rec of records) {
    const blocks: Anthropic.ToolUseBlock[] = rec.calls.map((c, i) => ({
      type: "tool_use",
      caller: { type: "direct" },
      id: `replay-${rec.step}-${i}`,
      name: c.name,
      input: c.input,
    }));
    executeToolCalls(blocks, ctx, seenRiderIds).forEach((out, i) => {
      const recorded = rec.calls[i].content;
      if (out.content !== recorded) {
        mismatches.push({ step: rec.step, call: i, recorded, replayed: out.content });
      }
    });
  }
  return { ok: mismatches.length === 0, mismatches };
}
