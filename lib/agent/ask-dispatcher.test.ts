/** @jest-environment node */
import {
  AskDispatcherInput,
  askDispatcher,
  askDispatcherDef,
  checkResumeChoice,
  type AskOption,
} from "./ask-dispatcher";
import { TOOL_ERRORS } from "./errors";
import { testContext } from "./test-context";

const ctx = testContext();
const two = {
  question: "Which Maria?",
  options: [
    { label: "María López, 12 Elm St", rider_id: "r1" },
    { label: "Maria Santos, 48 Birch Ave", rider_id: "r2" },
  ] satisfies AskOption[],
};

function resumeToken(): string {
  const asked = askDispatcher(two, ctx);
  if (asked.end?.status !== "needs_info") throw new Error("expected a needs_info end");
  return asked.end.resume;
}

describe("askDispatcher", () => {
  it("ends the run with the question, the options and a resume token", () => {
    const asked = askDispatcher(two, ctx);
    expect(asked.content).toBe('{"asked":true}');
    expect(asked.end).toMatchObject({
      status: "needs_info",
      question: "Which Maria?",
      options: two.options,
    });
  });

  it("returns an error for an option whose rider does not exist", () => {
    expect(
      askDispatcher({ question: "Who?", options: [{ label: "Someone", rider_id: "r9" }] }, ctx),
    ).toEqual({ content: TOOL_ERRORS.unknownRider("r9"), is_error: true });
  });

  it("accepts an option with no rider", () => {
    expect(
      askDispatcher(
        { question: "What time?", options: [{ label: "9:00 AM", rider_id: null }] },
        ctx,
      ).end?.status,
    ).toBe("needs_info");
  });
});

describe("checkResumeChoice", () => {
  it("returns the chosen option and the saved parsed trip", () => {
    expect(checkResumeChoice(resumeToken(), 1, ctx.secret, ctx.clock.now)).toMatchObject({
      ok: true,
      option: two.options[1],
      payload: { run_id: "run-1", parsed: ctx.parsed },
    });
  });

  it.each([2, -1, 1.5, NaN])("choice %s was not offered", (c) => {
    expect(checkResumeChoice(resumeToken(), c, ctx.secret, ctx.clock.now)).toEqual({
      ok: false,
      reason: "not_offered",
    });
  });

  it("rejects an expired token", () => {
    expect(
      checkResumeChoice(resumeToken(), 0, ctx.secret, new Date(ctx.clock.now.getTime() + 900_000)),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects an altered token", () => {
    expect(checkResumeChoice(resumeToken() + "x", 0, ctx.secret, ctx.clock.now).ok).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(checkResumeChoice("junk", 0, ctx.secret, ctx.clock.now)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});

describe("AskDispatcherInput", () => {
  it("rejects no options, five options and an option with no rider_id", () => {
    expect(AskDispatcherInput.safeParse({ question: "Q", options: [] }).success).toBe(false);
    expect(
      AskDispatcherInput.safeParse({
        question: "Q",
        options: Array(5).fill({ label: "a", rider_id: null }),
      }).success,
    ).toBe(false);
    expect(AskDispatcherInput.safeParse({ question: "Q", options: [{ label: "a" }] }).success).toBe(
      false,
    );
  });

  it("accepts one valid option", () => {
    expect(
      AskDispatcherInput.safeParse({ question: "Q", options: [{ label: "a", rider_id: null }] })
        .success,
    ).toBe(true);
  });
});

describe("askDispatcherDef", () => {
  it("is a strict definition with no count keywords", () => {
    expect(askDispatcherDef.name).toBe("ask_dispatcher");
    expect(askDispatcherDef.strict).toBe(true);
    expect(askDispatcherDef.input_schema.additionalProperties).toBe(false);
    expect(JSON.stringify(askDispatcherDef.input_schema)).not.toMatch(/minItems|maxItems/);
  });
});
