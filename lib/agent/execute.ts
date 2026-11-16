import type Anthropic from "@anthropic-ai/sdk";
import { TOOL_ERRORS } from "./errors";
import { runTool } from "./tools";
import type { ExecutedCall, ToolContext } from "./types";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Rider ids a call refers to. The input came from a model, so nothing here is trusted or thrown on. */
function referencedIds(name: string, input: unknown): string[] {
  if (!isRecord(input)) return [];
  if (name === "check_vehicle_availability" || name === "propose_trip") {
    return typeof input.rider_id === "string" ? [input.rider_id] : [];
  }
  if (name === "ask_dispatcher" && Array.isArray(input.options)) {
    return input.options.flatMap((o: unknown) =>
      isRecord(o) && typeof o.rider_id === "string" ? [o.rider_id] : [],
    );
  }
  return [];
}

/** Ids from a successful find_rider result; anything that is not the expected JSON adds nothing. */
function returnedIds(content: string): string[] {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed) || !Array.isArray(parsed.riders)) return [];
    return parsed.riders.flatMap((r: unknown) =>
      isRecord(r) && typeof r.id === "string" ? [r.id] : [],
    );
  } catch {
    return [];
  }
}

/**
 * Runs one model reply's tool calls in order. A rider id must have come from find_rider earlier in
 * the run, and nothing runs after the first result that ends the run. Never throws.
 */
export function executeToolCalls(
  blocks: Anthropic.ToolUseBlock[],
  ctx: ToolContext,
  seenRiderIds: Set<string>,
): ExecutedCall[] {
  const out: ExecutedCall[] = [];
  let ended = false;
  for (const { id, name, input } of blocks) {
    const fail = (content: string): ExecutedCall => ({
      id,
      name,
      input,
      content,
      is_error: true,
    });
    if (ended) {
      out.push(fail(TOOL_ERRORS.endedAlready));
      continue;
    }
    const unseen = referencedIds(name, input).find((rid) => !seenRiderIds.has(rid));
    if (unseen !== undefined) {
      out.push(fail(TOOL_ERRORS.notLookedUp(unseen)));
      continue;
    }
    const result = runTool(name, input, ctx);
    if (name === "find_rider" && !result.is_error) {
      for (const rid of returnedIds(result.content)) seenRiderIds.add(rid);
    }
    if (result.end !== undefined) ended = true;
    out.push({
      id,
      name,
      input,
      content: result.content,
      is_error: result.is_error === true,
      ...(result.expected === true ? { expected: true as const } : {}),
      ...(result.end !== undefined ? { end: result.end } : {}),
    });
  }
  return out;
}
