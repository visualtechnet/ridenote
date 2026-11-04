/** @jest-environment node */
import { UPSTREAM, thinkingFor } from "./config";

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
