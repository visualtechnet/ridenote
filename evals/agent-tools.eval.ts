/** @jest-environment node */
/**
 * Live check that the API accepts the four hand-written strict tool definitions. One small call, under
 * one cent. Not part of `npm test`; it runs with `npm run eval`.
 */
import Anthropic from "@anthropic-ai/sdk";
import { FindRiderInput } from "../lib/agent/find-rider";
import { TOOL_DEFS } from "../lib/agent/tools";
import { UPSTREAM, thinkingFor } from "../lib/config";

const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

(hasKey ? describe : describe.skip)("agent tool schemas (live model)", () => {
  it("the API accepts the four strict tool definitions", async () => {
    const client = new Anthropic();
    const model = process.env[UPSTREAM.modelEnvVar] ?? UPSTREAM.defaultModel;
    const response = await client.messages.create({
      model,
      max_tokens: 200,
      thinking: thinkingFor(model),
      tools: TOOL_DEFS as unknown as Anthropic.Tool[],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: "Find the rider named Nguyen." }],
    });
    console.log(
      `agent tool schemas: ${response.usage.input_tokens} input tokens, ${response.usage.output_tokens} output tokens`,
    );
    expect(response.stop_reason).toBe("tool_use");
    const calls = response.content.filter((block) => block.type === "tool_use");
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("find_rider");
    expect(FindRiderInput.safeParse(calls[0].input).success).toBe(true);
  }, 60_000);
});

if (!hasKey) {
  it("needs ANTHROPIC_API_KEY (.env.local, or `npm run eval:key` with the Keychain) to run the live eval", () => {
    throw new Error("ANTHROPIC_API_KEY is not set, so the live eval cannot run.");
  });
}
