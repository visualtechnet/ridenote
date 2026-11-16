// Test helper only: tests import it; nothing under lib/ or app/ does.
import type { AgentModel, ModelReply } from "./types";

let nextId = 1;

export function toolReply(
  calls: { id?: string; name: string; input: unknown }[],
  usage: Partial<ModelReply["usage"]> = {},
): ModelReply {
  return {
    content: calls.map((c) => ({
      type: "tool_use",
      caller: { type: "direct" },
      id: c.id ?? `toolu_${nextId++}`,
      name: c.name,
      input: c.input,
    })),
    stop_reason: "tool_use",
    usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, ...usage },
  };
}

export function textReply(text: string): ModelReply {
  return {
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0 },
  };
}

/** Plays the replies in order; an Error entry is thrown. Calling it more often than scripted throws. */
export function scriptedModel(replies: (ModelReply | Error)[]): AgentModel & { calls: number } {
  let calls = 0;
  const model: AgentModel = async () => {
    calls += 1;
    const next = replies[calls - 1];
    if (next === undefined) {
      throw new Error(`scriptedModel called ${calls} times but only ${replies.length} scripted`);
    }
    if (next instanceof Error) throw next;
    return next;
  };
  return Object.defineProperty(model, "calls", { get: () => calls }) as AgentModel & {
    calls: number;
  };
}
