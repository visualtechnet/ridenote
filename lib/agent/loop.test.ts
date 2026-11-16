/** @jest-environment node */
import type Anthropic from "@anthropic-ai/sdk";
import { AGENT } from "../config";
import { wrapNote } from "../prompt";
import { runAgent } from "./loop";
import { testContext } from "./test-context";
import { scriptedModel, textReply, toolReply } from "./test-model";
import type { AgentModel, ModelReply, StepRecord } from "./types";

const find = (name: string, id?: string) => ({ id, name: "find_rider", input: { name } });
const propose = {
  name: "propose_trip",
  input: {
    rider_id: "r4",
    pickup_date: "2026-11-03",
    pickup_time: "09:00",
    reasons: ["One match."],
  },
};
const check = {
  name: "check_vehicle_availability",
  input: { date: "2026-11-03", time: "09:00", rider_id: "r4" },
};

/** Wraps a model and keeps a copy of the messages each call saw. */
function spy(model: AgentModel) {
  const seen: Anthropic.MessageParam[][] = [];
  const wrapped: AgentModel = (req) => {
    seen.push(structuredClone(req.messages));
    return model(req);
  };
  return { wrapped, seen };
}

describe("runAgent", () => {
  it("finds a rider, checks a vehicle and proposes a trip", async () => {
    const model = scriptedModel([
      toolReply([find("Nguyen")], {
        input_tokens: 100,
        output_tokens: 10,
        cache_read_input_tokens: 5,
      }),
      toolReply([check], { input_tokens: 200, output_tokens: 20, cache_read_input_tokens: 5 }),
      toolReply([propose], { input_tokens: 300, output_tokens: 30 }),
    ]);
    const r = await runAgent({ model, ctx: testContext() });
    expect(r.status).toBe("proposed");
    if (r.status !== "proposed") return;
    expect(r.end.draftId).toBe("draft-1");
    expect(r.usage).toMatchObject({ steps: 3, inputTokens: 600, outputTokens: 60, cacheRead: 10 });
    expect(r.steps).toHaveLength(3);
    expect(r.steps.map((s) => s.step)).toEqual([1, 2, 3]);
    expect(r.steps[0].calls[0]).toMatchObject({ name: "find_rider", is_error: false });
  });

  it("sends the wrapped note first and returns tool_results right after the assistant content", async () => {
    const first = toolReply([find("Nguyen", "tA"), find("Santos", "tB")]);
    const { wrapped, seen } = spy(scriptedModel([first, toolReply([propose])]));
    const ctx = testContext();
    await runAgent({ model: wrapped, ctx });
    expect(seen[0]).toEqual([{ role: "user", content: wrapNote(ctx.note) }]);
    const second = seen[1];
    expect(second).toHaveLength(3);
    expect(second[1]).toEqual({ role: "assistant", content: first.content });
    const last = second[2];
    expect(last.role).toBe("user");
    const blocks = last.content as Anthropic.ToolResultBlockParam[];
    expect(blocks.map((b) => b.type)).toEqual(["tool_result", "tool_result"]);
    expect(blocks.map((b) => b.tool_use_id)).toEqual(["tA", "tB"]);
  });

  it("asks the dispatcher when two Marias match", async () => {
    const model = scriptedModel([
      toolReply([find("maria")]),
      toolReply([
        {
          name: "ask_dispatcher",
          input: {
            question: "Which Maria?",
            options: [
              { label: "María López", rider_id: "r1" },
              { label: "Maria Santos", rider_id: "r2" },
            ],
          },
        },
      ]),
    ]);
    const r = await runAgent({ model, ctx: testContext() });
    expect(r.status).toBe("needs_info");
    if (r.status === "needs_info") expect(r.end.options).toHaveLength(2);
  });

  it("stops at the step cap after six model calls", async () => {
    const names = ["Nguyen", "Santos", "Whitfield", "Neil", "Lopez", "Zed", "Yan"];
    const model = scriptedModel(names.map((n) => toolReply([find(n)])));
    const r = await runAgent({ model, ctx: testContext() });
    expect(r).toMatchObject({ status: "failed", reason: "step_cap" });
    expect(model.calls).toBe(AGENT.maxSteps);
    expect(r.usage.steps).toBe(AGENT.maxSteps);
  });

  it("stops when the token budget is spent, without another model call", async () => {
    const model = scriptedModel([
      toolReply([find("Nguyen")], { input_tokens: AGENT.maxRunTokens, output_tokens: 0 }),
      toolReply([propose]),
    ]);
    const r = await runAgent({ model, ctx: testContext() });
    expect(r).toMatchObject({ status: "failed", reason: "token_budget" });
    expect(model.calls).toBe(1);
  });

  it("stops at the deadline before the next model call", async () => {
    let t = 0;
    const now = () => t;
    const inner = scriptedModel([toolReply([find("Nguyen")]), toolReply([propose])]);
    const model: AgentModel = async (req) => {
      const reply = await inner(req);
      t = AGENT.deadlineMs + 1;
      return reply;
    };
    const r = await runAgent({ model, ctx: testContext(), now });
    expect(r).toMatchObject({ status: "failed", reason: "deadline" });
    expect(inner.calls).toBe(1);
    expect(r.usage.latencyMs).toBe(AGENT.deadlineMs + 1);
  });

  it("stops when the signal is aborted before the next call", async () => {
    const ac = new AbortController();
    const inner = scriptedModel([toolReply([find("Nguyen")]), toolReply([propose])]);
    const model: AgentModel = async (req) => {
      const reply = await inner(req);
      ac.abort();
      return reply;
    };
    const r = await runAgent({ model, ctx: testContext(), signal: ac.signal });
    expect(r).toMatchObject({ status: "failed", reason: "aborted" });
    expect(inner.calls).toBe(1);
  });

  it("maps an AbortError from the model to aborted", async () => {
    const err = Object.assign(new Error("x"), { name: "AbortError" });
    const r = await runAgent({ model: scriptedModel([err]), ctx: testContext() });
    expect(r).toMatchObject({ status: "failed", reason: "aborted" });
    expect(r.usage.steps).toBe(1);
  });

  it("maps any error while the signal is aborted to aborted", async () => {
    const ac = new AbortController();
    const model: AgentModel = async () => {
      ac.abort();
      throw new Error("socket closed");
    };
    const r = await runAgent({ model, ctx: testContext(), signal: ac.signal });
    expect(r).toMatchObject({ status: "failed", reason: "aborted" });
  });

  it("maps a thrown non-Error value to upstream", async () => {
    const model: AgentModel = () => Promise.reject("nope");
    const r = await runAgent({ model, ctx: testContext() });
    expect(r).toMatchObject({ status: "failed", reason: "upstream" });
  });

  it("maps any other model error to upstream", async () => {
    const r = await runAgent({ model: scriptedModel([new Error("500")]), ctx: testContext() });
    expect(r).toMatchObject({ status: "failed", reason: "upstream" });
  });

  it("re-prompts once when the model gives text, then fails with no_tool_call", async () => {
    const { wrapped, seen } = spy(
      scriptedModel([textReply("Here is the trip"), textReply("Again")]),
    );
    const r = await runAgent({ model: wrapped, ctx: testContext() });
    expect(r).toMatchObject({ status: "failed", reason: "no_tool_call" });
    expect(r.usage.steps).toBe(2);
    expect(seen).toHaveLength(2);
    const last = seen[1][seen[1].length - 1];
    expect(last.role).toBe("user");
    expect(typeof last.content).toBe("string");
    expect(last.content as string).toMatch(/tool/i);
    expect(JSON.stringify(r)).not.toContain("Here is the trip");
    expect(r).not.toHaveProperty("text");
  });

  it("recovers when a tool call follows the re-prompt", async () => {
    const model = scriptedModel([
      textReply("thinking"),
      toolReply([find("Nguyen")]),
      toolReply([propose]),
    ]);
    const r = await runAgent({ model, ctx: testContext() });
    expect(r.status).toBe("proposed");
    expect(r.usage.steps).toBe(3);
  });

  it("treats a tool_use stop with no tool blocks as no tool call", async () => {
    const reply: ModelReply = { ...textReply("x"), stop_reason: "tool_use" };
    const r = await runAgent({ model: scriptedModel([reply, reply]), ctx: testContext() });
    expect(r).toMatchObject({ status: "failed", reason: "no_tool_call" });
  });

  it("never runs a tool from a max_tokens reply", async () => {
    const newId = jest.fn(() => "draft-x");
    const reply: ModelReply = {
      ...toolReply([find("Nguyen"), propose]),
      stop_reason: "max_tokens",
    };
    const r = await runAgent({ model: scriptedModel([reply]), ctx: testContext({ newId }) });
    expect(r).toMatchObject({ status: "failed", reason: "cut_off" });
    expect(newId).not.toHaveBeenCalled();
    expect(r.steps[0].calls).toEqual([]);
  });

  it("never runs a tool from a refusal", async () => {
    const newId = jest.fn(() => "draft-x");
    const reply: ModelReply = { ...toolReply([propose]), stop_reason: "refusal" };
    const r = await runAgent({ model: scriptedModel([reply]), ctx: testContext({ newId }) });
    expect(r).toMatchObject({ status: "failed", reason: "refused" });
    expect(newId).not.toHaveBeenCalled();
  });

  it("fails with upstream on an unknown stop reason", async () => {
    const reply: ModelReply = { ...toolReply([find("Nguyen")]), stop_reason: "pause_turn" };
    const r = await runAgent({ model: scriptedModel([reply]), ctx: testContext() });
    expect(r).toMatchObject({ status: "failed", reason: "upstream" });
  });

  it("fails with upstream on a null stop reason", async () => {
    const reply: ModelReply = { ...toolReply([find("Nguyen")]), stop_reason: null };
    const r = await runAgent({ model: scriptedModel([reply]), ctx: testContext() });
    expect(r).toMatchObject({ status: "failed", reason: "upstream" });
  });

  it("stops after three steps in a row where every call errors", async () => {
    const bad = () => toolReply([{ name: "nope", input: {} }]);
    const model = scriptedModel([bad(), bad(), bad(), bad()]);
    const r = await runAgent({ model, ctx: testContext() });
    expect(r).toMatchObject({ status: "failed", reason: "invalid_tool_input" });
    expect(model.calls).toBe(AGENT.maxToolErrors);
    expect(r.steps).toHaveLength(AGENT.maxToolErrors);
  });

  it("does not count searches that find no rider as mistakes", async () => {
    const ask = toolReply([
      {
        name: "ask_dispatcher",
        input: {
          question: "Zelda is not on file. Who is the rider?",
          options: [{ label: "Not on file", rider_id: null }],
        },
      },
    ]);
    const model = scriptedModel([
      toolReply([find("Zelda")]),
      toolReply([find("Zeld")]),
      toolReply([find("Zelda Smith")]),
      toolReply([find("Smith")]),
      ask,
    ]);
    const r = await runAgent({ model, ctx: testContext() });
    expect(r.status).toBe("needs_info");
    expect(r.steps).toHaveLength(5);
  });

  it("still stops when real mistakes are mixed with searches that find no rider", async () => {
    const bad = () => toolReply([{ name: "nope", input: {} }]);
    const miss = () => toolReply([find("Zelda")]);
    // Two mistakes, a miss (which is not a mistake and resets the count), then three mistakes in a row.
    const model = scriptedModel([bad(), bad(), miss(), bad(), bad(), bad()]);
    const r = await runAgent({ model, ctx: testContext() });
    expect(r).toMatchObject({ status: "failed", reason: "invalid_tool_input" });
    expect(model.calls).toBe(6);
  });

  it("resets the error count after a step with a success", async () => {
    const bad = () => toolReply([{ name: "nope", input: {} }]);
    const model = scriptedModel([
      bad(),
      bad(),
      toolReply([find("Nguyen")]),
      bad(),
      bad(),
      toolReply([propose]),
    ]);
    const r = await runAgent({ model, ctx: testContext() });
    expect(r.status).toBe("proposed");
  });

  it("calls onStep once per model call with the record kept in the result", async () => {
    const onStep = jest.fn<void, [StepRecord]>();
    const model = scriptedModel([toolReply([find("Nguyen")]), toolReply([propose])]);
    const r = await runAgent({ model, ctx: testContext(), onStep });
    expect(onStep).toHaveBeenCalledTimes(2);
    expect(onStep.mock.calls.map((c) => c[0])).toEqual(r.steps);
  });

  it("keeps the note out of the step records", async () => {
    const ctx = testContext();
    const model = scriptedModel([
      toolReply([find("Nguyen")]),
      textReply("Maria"),
      toolReply([propose]),
    ]);
    const r = await runAgent({ model, ctx });
    expect(JSON.stringify(r.steps)).not.toContain(ctx.note);
    expect(r.steps[1]).toMatchObject({ stopReason: "end_turn", calls: [] });
  });

  it("times each step from the injected clock", async () => {
    let t = 0;
    const inner = scriptedModel([toolReply([find("Nguyen")]), toolReply([propose])]);
    const model: AgentModel = async (req) => {
      t += 25;
      return inner(req);
    };
    const r = await runAgent({ model, ctx: testContext(), now: () => t });
    expect(r.steps.map((s) => s.ms)).toEqual([25, 25]);
    expect(r.usage.latencyMs).toBe(50);
  });

  describe("a hung model call", () => {
    afterEach(() => jest.useRealTimers());

    /** Never settles on its own; rejects with an AbortError when the received signal aborts. */
    const hung = (): AgentModel & { calls: number } => {
      let calls = 0;
      const model: AgentModel = ({ signal }) => {
        calls += 1;
        return new Promise((_, reject) => {
          signal.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        });
      };
      return Object.defineProperty(model, "calls", { get: () => calls }) as AgentModel & {
        calls: number;
      };
    };

    it("is cut off by the deadline and fails with deadline", async () => {
      jest.useFakeTimers();
      const model = hung();
      const run = runAgent({ model, ctx: testContext() });
      await jest.advanceTimersByTimeAsync(AGENT.deadlineMs);
      expect(await run).toMatchObject({ status: "failed", reason: "deadline" });
      expect(model.calls).toBe(1);
    });

    it("still gives aborted when the caller aborts during the hung call", async () => {
      jest.useFakeTimers();
      const ac = new AbortController();
      const run = runAgent({ model: hung(), ctx: testContext(), signal: ac.signal });
      await jest.advanceTimersByTimeAsync(1000);
      ac.abort();
      expect(await run).toMatchObject({ status: "failed", reason: "aborted" });
    });

    it("leaves no pending timer when the call resolves before the deadline", async () => {
      jest.useFakeTimers();
      const model = scriptedModel([toolReply([find("Nguyen")]), toolReply([propose])]);
      const r = await runAgent({ model, ctx: testContext() });
      expect(r.status).toBe("proposed");
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  it("drops tool_use blocks from an end_turn reply before the re-prompt and recovers", async () => {
    const bad: ModelReply = { ...toolReply([find("Nguyen", "tX")]), stop_reason: "end_turn" };
    const { wrapped, seen } = spy(
      scriptedModel([bad, toolReply([find("Nguyen")]), toolReply([propose])]),
    );
    const r = await runAgent({ model: wrapped, ctx: testContext() });
    expect(r.status).toBe("proposed");
    const assistant = seen[1][1];
    expect(assistant).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "(no tool call)" }],
    });
    expect(JSON.stringify(seen[1])).not.toContain("tool_use");
  });

  it("keeps the text blocks of an end_turn reply that also had a tool_use block", async () => {
    const text = textReply("hello").content[0];
    const mixed: ModelReply = {
      ...toolReply([find("Nguyen", "tX")]),
      stop_reason: "end_turn",
    };
    mixed.content = [text, ...mixed.content];
    const { wrapped, seen } = spy(
      scriptedModel([mixed, toolReply([find("Nguyen")]), toolReply([propose])]),
    );
    await runAgent({ model: wrapped, ctx: testContext() });
    expect(seen[1][1]).toEqual({ role: "assistant", content: [text] });
  });

  it("pushes a one-text-block placeholder for an end_turn reply with empty content", async () => {
    const empty: ModelReply = { ...textReply("x"), content: [] };
    const { wrapped, seen } = spy(
      scriptedModel([empty, toolReply([find("Nguyen")]), toolReply([propose])]),
    );
    const r = await runAgent({ model: wrapped, ctx: testContext() });
    expect(r.status).toBe("proposed");
    expect(seen[1][1]).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "(no tool call)" }],
    });
    expect(seen[1][2].content).toMatch(/tool/i);
  });

  it("ignores an onStep that throws", async () => {
    const make = () => scriptedModel([toolReply([find("Nguyen")]), toolReply([propose])]);
    const plain = await runAgent({ model: make(), ctx: testContext() });
    const onStep = jest.fn(() => {
      throw new Error("sink down");
    });
    const r = await runAgent({ model: make(), ctx: testContext(), onStep });
    expect(onStep).toHaveBeenCalledTimes(2);
    expect(r.status).toBe(plain.status);
    expect(r.steps).toHaveLength(plain.steps.length);
  });

  it("marks an errored call is_error with its tool_use_id and leaves a success unmarked", async () => {
    const { wrapped, seen } = spy(
      scriptedModel([toolReply([find("", "tBad"), find("Nguyen", "tOk")]), toolReply([propose])]),
    );
    await runAgent({ model: wrapped, ctx: testContext() });
    const blocks = seen[1][2].content as Anthropic.ToolResultBlockParam[];
    expect(blocks[0]).toMatchObject({ type: "tool_result", tool_use_id: "tBad", is_error: true });
    expect(blocks[1].tool_use_id).toBe("tOk");
    expect(blocks[1]).not.toHaveProperty("is_error");
  });
});
