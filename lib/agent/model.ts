import type Anthropic from "@anthropic-ai/sdk";
import { AGENT, UPSTREAM, thinkingFor } from "../config";
import { TOOL_DEFS } from "./tools";
import type { AgentModel } from "./types";

/** Model families that reject a forced tool choice (tool_choice "any") with a 400. */
const NO_FORCED_CHOICE = ["claude-sonnet-5", "claude-opus-5", "claude-fable-5"] as const;

export function forcedChoiceSupported(model: string): boolean {
  return !NO_FORCED_CHOICE.some((prefix) => model.startsWith(prefix));
}

/** The agent's model: AGENT_MODEL, else MODEL, else the default. Fails fast on one that cannot force a tool. */
export function agentModelName(env: Record<string, string | undefined>): string {
  const model =
    env.AGENT_MODEL?.trim() || env[UPSTREAM.modelEnvVar]?.trim() || UPSTREAM.defaultModel;
  if (!forcedChoiceSupported(model)) {
    throw new Error(
      `Model ${model} cannot be used for the agent: forced tool choice is not supported.`,
    );
  }
  return model;
}

/** Every step forces exactly one tool call, with reasoning off. */
export function createAnthropicModel(
  client: Pick<Anthropic, "messages">,
  options: { model: string; system: string },
): AgentModel {
  return async ({ messages, signal }) => {
    const res = await client.messages.create(
      {
        model: options.model,
        max_tokens: AGENT.maxStepTokens,
        thinking: thinkingFor(options.model),
        system: options.system,
        tools: [...TOOL_DEFS],
        tool_choice: { type: "any", disable_parallel_tool_use: true },
        messages,
      },
      { signal },
    );
    return { content: res.content, stop_reason: res.stop_reason, usage: res.usage };
  };
}
