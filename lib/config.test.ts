/** @jest-environment node */
import { AGENT, UPSTREAM, thinkingFor } from "./config";

describe("thinkingFor (how each model is told not to think)", () => {
  it("sends disabled to the default model and to any model that accepts it", () => {
    expect(thinkingFor(UPSTREAM.defaultModel)).toEqual({ type: "disabled" });
    expect(thinkingFor("claude-haiku-5-5")).toEqual({ type: "disabled" });
    expect(thinkingFor("some-other-model")).toEqual({ type: "disabled" });
  });

  it("sends between_tools to Sonnet 5.x, which rejects disabled with a 400", () => {
    expect(thinkingFor("claude-sonnet-5-5")).toEqual({ type: "between_tools" });
    expect(thinkingFor("claude-sonnet-5")).toEqual({ type: "between_tools" });
  });
});

describe("AGENT limits", () => {
  it("agent limits match the design", () => {
    expect(AGENT.maxMatches).toBe(3);
    expect(AGENT.riderNotesMax).toBe(200);
    expect(AGENT.maxOptions).toBe(4);
    expect(AGENT.issueMax).toBe(200);
    expect(AGENT.tokenTtlMs).toBe(900_000);
  });

  it("agent loop limits match the design", () => {
    expect(AGENT.maxSteps).toBe(6);
    expect(AGENT.maxRunTokens).toBe(20_000);
    expect(AGENT.maxStepTokens).toBe(400);
    expect(AGENT.deadlineMs).toBe(60_000);
    expect(AGENT.maxToolErrors).toBe(3);
  });
});
