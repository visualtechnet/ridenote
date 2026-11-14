/** @jest-environment node */
import type Anthropic from "@anthropic-ai/sdk";
import { TOOL_ERRORS } from "./errors";
import { executeToolCalls } from "./execute";
import { testContext } from "./test-context";
import * as tools from "./tools";

jest.mock("./tools", () => {
  const actual = jest.requireActual("./tools");
  return { ...actual, runTool: jest.fn(actual.runTool) };
});

const block = (id: string, name: string, input: unknown): Anthropic.ToolUseBlock => ({
  type: "tool_use",
  caller: { type: "direct" },
  id,
  name,
  input,
});

const propose = (rider_id: unknown, pickup_date = "2026-11-03") => ({
  rider_id,
  pickup_date,
  pickup_time: "09:00",
  reasons: ["One rider matched."],
});

describe("executeToolCalls", () => {
  it("find_rider returns the rider and records its id", () => {
    const seen = new Set<string>();
    const [r] = executeToolCalls(
      [block("t1", "find_rider", { name: "Nguyen" })],
      testContext(),
      seen,
    );
    expect(r).toMatchObject({ id: "t1", name: "find_rider", is_error: false });
    expect(r.content).toContain("r4");
    expect(r.end).toBeUndefined();
    expect([...seen]).toEqual(["r4"]);
  });

  it("find_rider with a failing result records nothing", () => {
    const seen = new Set<string>();
    const [r] = executeToolCalls(
      [block("t1", "find_rider", { name: "Zzzz" })],
      testContext(),
      seen,
    );
    expect(r.is_error).toBe(true);
    expect(seen.size).toBe(0);
  });

  it("find_rider ignores a result that is not valid rider JSON", () => {
    const seen = new Set<string>();
    const [r] = executeToolCalls([block("t1", "find_rider", { name: "" })], testContext(), seen);
    expect(r.is_error).toBe(true);
    expect(seen.size).toBe(0);
  });

  it("propose_trip with an unseen id is an error with no end, and works after find_rider", () => {
    const ctx = testContext();
    const seen = new Set<string>();
    const [bad] = executeToolCalls([block("t1", "propose_trip", propose("r1"))], ctx, seen);
    expect(bad).toMatchObject({ is_error: true, content: TOOL_ERRORS.notLookedUp("r1") });
    expect(bad.end).toBeUndefined();
    const out = executeToolCalls(
      [block("t2", "find_rider", { name: "López" }), block("t3", "propose_trip", propose("r1"))],
      ctx,
      seen,
    );
    expect(out[1].is_error).toBe(false);
    expect(out[1].end).toMatchObject({ status: "proposed" });
  });

  it("check_vehicle_availability with an unseen id returns the same error", () => {
    const [r] = executeToolCalls(
      [block("t1", "check_vehicle_availability", { rider_id: "r2", date: "2026-11-03" })],
      testContext(),
      new Set(),
    );
    expect(r).toMatchObject({ is_error: true, content: TOOL_ERRORS.notLookedUp("r2") });
  });

  it("ask_dispatcher errors on a never-returned option id and allows null ids", () => {
    const ctx = testContext();
    const [bad] = executeToolCalls(
      [
        block("t1", "ask_dispatcher", {
          question: "Which Maria?",
          options: [
            { label: "None", rider_id: null },
            { label: "Maria", rider_id: "r2" },
          ],
        }),
      ],
      ctx,
      new Set(),
    );
    expect(bad).toMatchObject({ is_error: true, content: TOOL_ERRORS.notLookedUp("r2") });
    const [ok] = executeToolCalls(
      [
        block("t2", "ask_dispatcher", {
          question: "Where to?",
          options: [{ label: "Hospital", rider_id: null }],
        }),
      ],
      ctx,
      new Set(),
    );
    expect(ok.is_error).toBe(false);
    expect(ok.end).toMatchObject({ status: "needs_info" });
  });

  it("stops after the first ending call and runs it once", () => {
    const newId = jest.fn(() => "draft-1");
    const ctx = testContext({ newId });
    const out = executeToolCalls(
      [
        block("t1", "propose_trip", propose("r1")),
        block("t2", "ask_dispatcher", {
          question: "Q?",
          options: [{ label: "A", rider_id: null }],
        }),
      ],
      ctx,
      new Set(["r1"]),
    );
    expect(out).toHaveLength(2);
    expect(out[0].end).toBeDefined();
    expect(out[1]).toMatchObject({
      id: "t2",
      name: "ask_dispatcher",
      is_error: true,
      content: TOOL_ERRORS.endedAlready,
    });
    expect(out[1].end).toBeUndefined();
    expect(newId).toHaveBeenCalledTimes(1);
  });

  it("runs find_rider placed before an ending call", () => {
    const out = executeToolCalls(
      [block("t1", "find_rider", { name: "López" }), block("t2", "propose_trip", propose("r1"))],
      testContext(),
      new Set(),
    );
    expect(out.map((o) => o.is_error)).toEqual([false, false]);
    expect(out[1].end).toBeDefined();
  });

  it("does not throw on odd inputs", () => {
    const seen = new Set<string>();
    const inputs: unknown[] = [
      "just a string",
      null,
      [1, 2],
      { rider_id: 5 },
      { options: "x" },
      { options: [null, "a", { rider_id: 7 }] },
    ];
    for (const input of inputs) {
      for (const name of ["propose_trip", "check_vehicle_availability", "ask_dispatcher"]) {
        const [r] = executeToolCalls([block("t", name, input)], testContext(), seen);
        expect(r.is_error).toBe(true);
      }
    }
  });

  it("a failed ending tool has no end", () => {
    const [r] = executeToolCalls(
      [block("t1", "propose_trip", propose("r1", "not-a-date"))],
      testContext(),
      new Set(["r1"]),
    );
    expect(r.is_error).toBe(true);
    expect(r.end).toBeUndefined();
  });

  it("a failed ending tool lets later calls run", () => {
    const out = executeToolCalls(
      [
        block("t1", "propose_trip", propose("r1", "not-a-date")),
        block("t2", "find_rider", { name: "Nguyen" }),
      ],
      testContext(),
      new Set(["r1"]),
    );
    expect(out[1].is_error).toBe(false);
  });

  it.each([["not json"], ["[]"], ['{"riders":"x"}'], ['{"riders":[null,{"id":3},{"id":"r9"}]}']])(
    "find_rider with an odd result body records only string ids",
    (body) => {
      jest.mocked(tools.runTool).mockReturnValueOnce({ content: body });
      const seen = new Set<string>();
      executeToolCalls([block("t1", "find_rider", { name: "x" })], testContext(), seen);
      expect([...seen]).toEqual(body.includes("r9") ? ["r9"] : []);
    },
  );
});
