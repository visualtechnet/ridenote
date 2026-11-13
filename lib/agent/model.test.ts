import type Anthropic from "@anthropic-ai/sdk";
import { AGENT, UPSTREAM, thinkingFor } from "../config";
import { agentModelName, createAnthropicModel, forcedChoiceSupported } from "./model";
import { TOOL_DEFS } from "./tools";

describe("forcedChoiceSupported", () => {
  it("is true for haiku", () => {
    expect(forcedChoiceSupported("claude-haiku-5-5")).toBe(true);
  });
  it("is false for sonnet 5", () => {
    expect(forcedChoiceSupported("claude-sonnet-5-5")).toBe(false);
  });
  it("is false for opus 5", () => {
    expect(forcedChoiceSupported("claude-opus-5-5")).toBe(false);
  });
  it("is false for fable 5", () => {
    expect(forcedChoiceSupported("claude-fable-5-2")).toBe(false);
  });
});

describe("agentModelName", () => {
  it("defaults to the upstream default model", () => {
    expect(agentModelName({})).toBe(UPSTREAM.defaultModel);
  });
  it("lets MODEL override the default", () => {
    expect(agentModelName({ MODEL: "claude-haiku-5-6" })).toBe("claude-haiku-5-6");
  });
  it("lets AGENT_MODEL win over MODEL", () => {
    expect(agentModelName({ AGENT_MODEL: "claude-haiku-5-7", MODEL: "claude-haiku-5-6" })).toBe(
      "claude-haiku-5-7",
    );
  });
  it("rejects a model that cannot force a tool choice", () => {
    expect(() => agentModelName({ AGENT_MODEL: "claude-sonnet-5-5" })).toThrow(
      /claude-sonnet-5-5.*forced tool choice is not supported/,
    );
  });
});

describe("createAnthropicModel", () => {
  it("sends one forced single-tool request and returns the reply unchanged", async () => {
    const reply = {
      content: [{ type: "tool_use", id: "t1", name: "find_rider", input: {} }],
      stop_reason: "tool_use",
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2 },
      extra: "ignored",
    };
    const create = jest.fn().mockResolvedValue(reply);
    const client = { messages: { create } } as unknown as Pick<Anthropic, "messages">;
    const model = createAnthropicModel(client, { model: "claude-haiku-5-5", system: "SYS" });
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: "hi" }];
    const signal = new AbortController().signal;

    const out = await model({ messages, signal });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      {
        model: "claude-haiku-5-5",
        max_tokens: AGENT.maxStepTokens,
        thinking: thinkingFor("claude-haiku-5-5"),
        system: "SYS",
        tools: TOOL_DEFS,
        tool_choice: { type: "any", disable_parallel_tool_use: true },
        messages,
      },
      { signal },
    );
    expect(out).toEqual({
      content: reply.content,
      stop_reason: "tool_use",
      usage: reply.usage,
    });
  });
});
