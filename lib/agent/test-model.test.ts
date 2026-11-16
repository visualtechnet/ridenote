/** @jest-environment node */
import { scriptedModel, textReply, toolReply } from "./test-model";

const req = () => ({ messages: [], signal: new AbortController().signal });

describe("scriptedModel", () => {
  it("returns the replies in order and counts calls", async () => {
    const a = textReply("a");
    const b = textReply("b");
    const model = scriptedModel([a, b]);
    expect(model.calls).toBe(0);
    expect(await model(req())).toBe(a);
    expect(await model(req())).toBe(b);
    expect(model.calls).toBe(2);
  });

  it("throws an Error entry instead of returning it", async () => {
    const model = scriptedModel([new Error("boom")]);
    await expect(model(req())).rejects.toThrow("boom");
    expect(model.calls).toBe(1);
  });

  it("throws a clear error when called more times than scripted", async () => {
    const model = scriptedModel([textReply("a")]);
    await model(req());
    await expect(model(req())).rejects.toThrow("scriptedModel called 2 times but only 1 scripted");
  });
});

describe("reply builders", () => {
  it("toolReply builds tool_use blocks with default ids and usage", () => {
    const r = toolReply([{ name: "find_rider", input: { name: "x" } }]);
    expect(r.stop_reason).toBe("tool_use");
    expect(r.content).toHaveLength(1);
    expect(r.content[0]).toMatchObject({ type: "tool_use", name: "find_rider" });
    expect(r.usage.input_tokens).toBeGreaterThan(0);
  });

  it("toolReply keeps a given id and overrides usage", () => {
    const r = toolReply([{ id: "abc", name: "n", input: {} }], { input_tokens: 7 });
    expect(r.content[0]).toMatchObject({ id: "abc" });
    expect(r.usage.input_tokens).toBe(7);
  });

  it("textReply builds a single text block that ends the turn", () => {
    const r = textReply("hi");
    expect(r.stop_reason).toBe("end_turn");
    expect(r.content).toMatchObject([{ type: "text", text: "hi" }]);
  });
});
