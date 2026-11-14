import { withStepTimeout, StepTimeoutError } from "./step-timeout";
import { scriptedModel, textReply, toolReply } from "./test-model";
import type { AgentModel, ModelReply } from "./types";

const messages = [{ role: "user" as const, content: "hi" }];
const apiError = (status: number) => Object.assign(new Error("api"), { status });

/** Never answers, but ends when its signal aborts. */
const hangs = (): AgentModel => (req) =>
  new Promise<ModelReply>((_resolve, reject) =>
    req.signal.addEventListener("abort", () => reject(new Error("aborted"))),
  );

describe("withStepTimeout", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("returns the reply when the call is quick", async () => {
    const model = withStepTimeout(scriptedModel([textReply("ok")]), { stepMs: 1000, retries: 1 });
    await expect(model({ messages, signal: new AbortController().signal })).resolves.toMatchObject({
      stop_reason: "end_turn",
    });
  });

  it("retries once after a timeout and returns the second answer", async () => {
    let calls = 0;
    const inner: AgentModel = (req) => {
      calls += 1;
      return calls === 1
        ? hangs()(req)
        : Promise.resolve(toolReply([{ name: "find_rider", input: {} }]));
    };
    const pending = withStepTimeout(inner, { stepMs: 1000, retries: 1 })({
      messages,
      signal: new AbortController().signal,
    });
    await jest.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toMatchObject({ stop_reason: "tool_use" });
    expect(calls).toBe(2);
  });

  it("gives up with a timeout error when every try times out", async () => {
    const pending = withStepTimeout(hangs(), { stepMs: 1000, retries: 1 })({
      messages,
      signal: new AbortController().signal,
    });
    const settled = pending.catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(2000);
    expect(await settled).toBeInstanceOf(StepTimeoutError);
  });

  it("retries a server error but not a bad request", async () => {
    let calls = 0;
    const flaky: AgentModel = async () => {
      calls += 1;
      if (calls === 1) throw apiError(503);
      return textReply("ok");
    };
    const model = withStepTimeout(flaky, { stepMs: 1000, retries: 1 });
    await expect(model({ messages, signal: new AbortController().signal })).resolves.toBeDefined();
    expect(calls).toBe(2);

    const badRequest = withStepTimeout(
      async () => {
        throw apiError(400);
      },
      { stepMs: 1000, retries: 1 },
    );
    await expect(badRequest({ messages, signal: new AbortController().signal })).rejects.toThrow(
      "api",
    );
  });

  it("does not retry when the run itself was stopped", async () => {
    const run = new AbortController();
    const pending = withStepTimeout(hangs(), { stepMs: 1000, retries: 1 })({
      messages,
      signal: run.signal,
    });
    const settled = pending.catch((e: unknown) => e);
    run.abort();
    expect(await settled).toEqual(new Error("aborted"));
  });

  it("retries a lost connection", async () => {
    let calls = 0;
    const flaky: AgentModel = async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("net"), { name: "APIConnectionError" });
      return textReply("ok");
    };
    await withStepTimeout(flaky, { stepMs: 1000, retries: 1 })({
      messages,
      signal: new AbortController().signal,
    });
    expect(calls).toBe(2);
  });
});
