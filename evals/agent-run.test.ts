/** @jest-environment node */
import type Anthropic from "@anthropic-ai/sdk";
import { wrapNote } from "../lib/prompt";
import { scriptedModel, toolReply } from "../lib/agent/test-model";
import type { AgentModel } from "../lib/agent/types";
import { makeTrip } from "../tests/test-utils";
import { AGENT_CASES } from "./agent-cases";
import { overBudget, parseMaxUsd, runAgentCase, type CaseDeps } from "./agent-run";

const byName = (name: string) => {
  const c = AGENT_CASES.find((x) => x.name === name);
  if (!c) throw new Error(`no case ${name}`);
  return c;
};

const okParse: CaseDeps["parse"] = async () => ({
  ok: true,
  trip: makeTrip({ passenger_name: "James O'Neil", pickup_date: "2026-11-03" }),
  inputTokens: 40,
  outputTokens: 7,
});

const happy = () =>
  scriptedModel([
    toolReply([{ name: "find_rider", input: { name: "O'Neil" } }], {
      input_tokens: 100,
      output_tokens: 10,
      cache_read_input_tokens: 5,
    }),
    toolReply(
      [
        {
          name: "check_vehicle_availability",
          input: { date: "2026-11-03", time: "09:00", rider_id: "r3" },
        },
      ],
      { input_tokens: 200, output_tokens: 20, cache_read_input_tokens: 5 },
    ),
    toolReply(
      [
        {
          name: "propose_trip",
          input: {
            rider_id: "r3",
            pickup_date: "2026-11-03",
            pickup_time: "09:00",
            reasons: ["One match."],
          },
        },
      ],
      { input_tokens: 300, output_tokens: 30 },
    ),
  ]);

describe("runAgentCase", () => {
  it("passes a scripted happy path and counts the parse call's tokens", async () => {
    const out = await runAgentCase(
      { parse: okParse, model: happy() },
      byName("complete note, known rider"),
    );
    expect(out.problems).toEqual([]);
    expect(out.row).toMatchObject({
      ended: "proposed",
      steps: 3,
      checkedVehicle: true,
      inputTokens: 640,
      outputTokens: 67,
      cacheRead: 10,
    });
    expect(out.row.tools).toEqual(["find_rider", "check_vehicle_availability", "propose_trip"]);
    expect(out.row.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("reports a parse failure without running the loop", async () => {
    const model = scriptedModel([]);
    const out = await runAgentCase(
      { parse: async () => ({ ok: false, error: "overloaded" }), model },
      byName("two Marias"),
    );
    expect(out.row.ended).toBe("parse failed");
    expect(out.problems).toHaveLength(1);
    expect(out.problems[0]).toBe("parse failed: overloaded");
    expect(model.calls).toBe(0);
  });

  it("turns a model that throws into a failed row instead of throwing", async () => {
    const model = scriptedModel([new Error("boom")]);
    const out = await runAgentCase({ parse: okParse, model }, byName("two Marias"));
    expect(out.row.ended).toBe("failed: upstream");
    expect(out.problems.length).toBeGreaterThan(0);
  });

  it("turns a parse that throws into a problem instead of throwing", async () => {
    const out = await runAgentCase(
      {
        parse: async () => {
          throw new Error("network down");
        },
        model: scriptedModel([]),
      },
      byName("two Marias"),
    );
    expect(out.row.ended).toBe("parse failed");
    expect(out.problems[0]).toContain("network down");
  });

  it("names both endings when a run proposes where needs_info was expected", async () => {
    const model = scriptedModel([
      toolReply([{ name: "find_rider", input: { name: "James" } }]),
      toolReply([
        {
          name: "propose_trip",
          input: {
            rider_id: "r3",
            pickup_date: "2026-11-03",
            pickup_time: "09:00",
            reasons: ["Guess."],
          },
        },
      ]),
    ]);
    const out = await runAgentCase({ parse: okParse, model }, byName("two Marias"));
    expect(out.row.ended).toBe("proposed");
    expect(out.problems.join(" ")).toContain("ended proposed, expected needs_info");
  });

  it("gives the loop the case's own note and a signing secret", async () => {
    const seen: Anthropic.MessageParam[][] = [];
    const inner = scriptedModel([toolReply([{ name: "find_rider", input: { name: "x" } }])]);
    const model: AgentModel = (req) => {
      seen.push(structuredClone(req.messages));
      return inner(req);
    };
    const c = byName("two Marias");
    await runAgentCase({ parse: okParse, model }, c);
    expect(seen[0][0].content).toBe(wrapNote(c.note));
  });

  it("signs the draft with a secret of at least 32 characters", async () => {
    const out = await runAgentCase(
      { parse: okParse, model: happy() },
      byName("complete note, known rider"),
    );
    // A short secret would make the sign step throw, which would surface as a failed run.
    expect(out.row.ended).toBe("proposed");
  });
});

describe("overBudget", () => {
  it("is true only once spending is past the limit", () => {
    expect(overBudget(0.99, 1)).toBe(false);
    expect(overBudget(1, 1)).toBe(false);
    expect(overBudget(1.01, 1)).toBe(true);
  });
});

describe("parseMaxUsd", () => {
  it("defaults to 1 when unset or empty", () => {
    expect(parseMaxUsd(undefined)).toBe(1);
    expect(parseMaxUsd("")).toBe(1);
  });

  it("accepts a positive number and the literal Infinity", () => {
    expect(parseMaxUsd("0.5")).toBe(0.5);
    expect(parseMaxUsd("Infinity")).toBe(Infinity);
  });

  it.each([["$2"], ["1,5"], ["abc"], ["-1"], ["0"], ["NaN"]])("refuses %s", (raw) => {
    expect(() => parseMaxUsd(raw)).toThrow(`EVAL_MAX_USD`);
    expect(() => parseMaxUsd(raw)).toThrow(raw);
  });
});
