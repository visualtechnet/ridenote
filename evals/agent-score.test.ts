import { RIDERS, searchRiders } from "../lib/agent/riders";
import type { MergedTrip, RunResult, StepRecord } from "../lib/agent/types";
import { vehicleServiceDown } from "../lib/agent/vehicles";
import { makeTrip } from "../tests/test-utils";
import { AGENT_CASES, type PathExpectation } from "./agent-cases";
import { checkedVehicle, scorePath } from "./agent-score";
import { CLOCK } from "./cases";

type Call = { name: string; input?: unknown; content?: string; is_error?: boolean };

function steps(...calls: Call[][]): StepRecord[] {
  return calls.map((cs, i) => ({
    step: i + 1,
    stopReason: "tool_use",
    calls: cs.map((c) => ({
      name: c.name,
      input: c.input ?? {},
      content: c.content ?? "{}",
      is_error: c.is_error ?? false,
    })),
    inputTokens: 100,
    outputTokens: 20,
    cacheRead: 0,
    ms: 5,
  }));
}

const usage = { steps: 0, inputTokens: 0, outputTokens: 0, cacheRead: 0, latencyMs: 0 };

function needsInfo(s: StepRecord[], riderIds: (string | null)[] = ["r1", "r2"]): RunResult {
  return {
    usage,
    steps: s,
    status: "needs_info",
    end: {
      status: "needs_info",
      question: "Which Maria?",
      options: riderIds.map((id) => ({ label: id ?? "none", rider_id: id })),
      resume: "tok",
    },
  };
}

function proposed(s: StepRecord[], merged?: Partial<MergedTrip>, trip = {}): RunResult {
  return {
    usage,
    steps: s,
    status: "proposed",
    end: {
      status: "proposed",
      draftId: "d1",
      draft: "tok",
      merged: {
        trip: makeTrip(trip),
        sources: { pickup: "note", mobility: "rider_file" },
        conflicts: [],
        ...merged,
      },
    },
  };
}

const case1: PathExpectation = {
  ends: "needs_info",
  callsInOrder: ["find_rider", "ask_dispatcher"],
  neverCall: ["propose_trip"],
  optionRiderIds: ["r1", "r2"],
};
const goodSteps = () => steps([{ name: "find_rider" }], [{ name: "ask_dispatcher" }]);

describe("scorePath", () => {
  it("passes a run that satisfies every field", () => {
    expect(scorePath(needsInfo(goodSteps()), case1)).toEqual([]);
  });

  it("names the wrong ending", () => {
    const problems = scorePath(proposed(goodSteps()), case1);
    expect(problems).toContain("ended proposed, expected needs_info");
  });

  it("names a failed run with its reason", () => {
    const failed: RunResult = { usage, steps: [], status: "failed", reason: "step_cap" };
    expect(scorePath(failed, case1)).toEqual(["run failed: step_cap"]);
  });

  it("flags a forbidden tool call", () => {
    const s = steps(
      [{ name: "find_rider" }],
      [{ name: "propose_trip" }],
      [{ name: "ask_dispatcher" }],
    );
    expect(scorePath(needsInfo(s), case1)).toEqual([
      "called propose_trip, which it must never call",
    ]);
  });

  it("flags a missing option id", () => {
    expect(scorePath(needsInfo(goodSteps(), ["r1", null]), case1)).toEqual([
      "options lack rider r2",
    ]);
  });

  it("flags calls out of order", () => {
    const s = steps([{ name: "ask_dispatcher" }], [{ name: "find_rider" }]);
    expect(scorePath(needsInfo(s), case1)).toEqual([
      "calls out of order: expected find_rider, ask_dispatcher in that order, got ask_dispatcher, find_rider",
    ]);
  });

  it("finds a subsequence across steps and within one step", () => {
    const s = steps(
      [{ name: "find_rider" }, { name: "x" }],
      [{ name: "y" }, { name: "ask_dispatcher" }],
    );
    expect(scorePath(needsInfo(s), case1)).toEqual([]);
  });

  it("counts steps against maxSteps", () => {
    const s = steps([{ name: "a" }], [{ name: "b" }], [{ name: "c" }]);
    expect(scorePath(proposed(s), { ends: "proposed", maxSteps: 2 })).toEqual([
      "took 3 steps, expected at most 2",
    ]);
    expect(scorePath(proposed(s), { ends: "proposed", maxSteps: 3 })).toEqual([]);
  });

  it("skips optionRiderIds on a proposed ending", () => {
    expect(scorePath(proposed([]), { ends: "proposed", optionRiderIds: ["r1"] })).toEqual([]);
  });

  it("checks the draft fields in end.merged", () => {
    const expectAll: PathExpectation = {
      ends: "proposed",
      draftRiderId: "r4",
      draftPassenger: "Dorothy Nguyen",
      draftPickup: "301 Cedar Ct",
      draftMobility: ["stretcher"],
      pickupSource: "rider_file",
      conflict: "mobility",
    };
    const good = proposed(
      steps([{ name: "propose_trip", input: { rider_id: "r4" } }]),
      {
        sources: { pickup: "rider_file", mobility: "rider_file" },
        conflicts: ["mobility"],
      },
      {
        passenger_name: "Dorothy Nguyen",
        pickup_location: "301 Cedar Ct",
        mobility: ["stretcher"],
      },
    );
    expect(scorePath(good, expectAll)).toEqual([]);

    const bad = proposed(steps([{ name: "propose_trip", input: { rider_id: "r2" } }]), undefined, {
      mobility: ["walker"],
    });
    expect(scorePath(bad, expectAll)).toEqual([
      'draftRiderId: expected "r4", got "r2"',
      'draftPassenger: expected "Dorothy Nguyen", got "Mrs. Lee"',
      'draftPickup: expected "301 Cedar Ct", got "12 Oak St"',
      "draftMobility: expected [stretcher], got [walker]",
      'pickupSource: expected "rider_file", got "note"',
      "conflict: expected a mobility conflict, got none",
    ]);
  });

  it("reads draftRiderId from the propose_trip call that was not an error", () => {
    const s = steps(
      [{ name: "propose_trip", input: { rider_id: "r1" }, is_error: true }],
      [{ name: "propose_trip", input: { rider_id: "r3" } }],
    );
    expect(scorePath(proposed(s), { ends: "proposed", draftRiderId: "r3" })).toEqual([]);
    expect(scorePath(proposed([]), { ends: "proposed", draftRiderId: "r3" })).toEqual([
      'draftRiderId: expected "r3", got null',
    ]);
  });

  it("compares mobility without regard to order", () => {
    const r = proposed([], undefined, { mobility: ["walker", "cane"] });
    expect(scorePath(r, { ends: "proposed", draftMobility: ["cane", "walker"] })).toEqual([]);
  });
});

describe("checkedVehicle", () => {
  const ok = {
    name: "check_vehicle_availability",
    content: '{"available":true,"vehicle_class":"sedan"}',
  };

  it("is true when an available check came before propose_trip", () => {
    expect(checkedVehicle(proposed(steps([ok], [{ name: "propose_trip" }])))).toBe(true);
  });

  it("is true when no propose_trip follows", () => {
    expect(checkedVehicle(needsInfo(steps([ok])))).toBe(true);
  });

  it("is false when propose_trip came first", () => {
    expect(checkedVehicle(proposed(steps([{ name: "propose_trip" }], [ok])))).toBe(false);
  });

  it("is false when propose_trip is in the same step before the check", () => {
    expect(checkedVehicle(proposed(steps([{ name: "propose_trip" }, ok])))).toBe(false);
  });

  it("is false when the check returned an error", () => {
    const bad = { name: "check_vehicle_availability", content: "service down", is_error: true };
    expect(checkedVehicle(proposed(steps([bad], [{ name: "propose_trip" }])))).toBe(false);
  });

  it("is false when no check ran", () => {
    expect(checkedVehicle(proposed(steps([{ name: "propose_trip" }])))).toBe(false);
  });
});

describe("AGENT_CASES", () => {
  it("has nine cases", () => {
    expect(AGENT_CASES).toHaveLength(9);
  });

  it("has unique names and non-empty notes", () => {
    expect(new Set(AGENT_CASES.map((c) => c.name)).size).toBe(AGENT_CASES.length);
    for (const c of AGENT_CASES) expect(c.note.trim()).not.toBe("");
  });

  it("has exactly five critical cases", () => {
    expect(AGENT_CASES.filter((c) => c.critical)).toHaveLength(5);
  });

  it("only names rider ids that exist", () => {
    const ids = new Set(RIDERS.map((r) => r.id));
    for (const c of AGENT_CASES) {
      if (c.expect.draftRiderId !== undefined) expect(ids.has(c.expect.draftRiderId)).toBe(true);
      for (const id of c.expect.optionRiderIds ?? []) expect(ids.has(id)).toBe(true);
    }
  });

  it("matches the rider fixtures the notes rely on", () => {
    const ids = (q: string) => searchRiders(RIDERS, q).map((r) => r.id);
    expect(ids("Maria")).toEqual(["r1", "r2"]);
    expect(ids("Maria Santos")).toEqual(["r2"]);
    expect(ids("James O'Neil")).toEqual(["r3"]);
    expect(ids("Dorothy Nguyen")).toEqual(["r4"]);
    expect(ids("Sam Whitfield")).toEqual(["r5"]);
    expect(ids("Hector Alvarez")).toEqual([]);
    expect(RIDERS.find((r) => r.id === "r5")?.mobility_on_file).toEqual([]);
    const draft4 = AGENT_CASES.find(
      (c) => c.expect.draftRiderId === undefined && c.expect.draftPickup,
    );
    expect(draft4?.expect.draftMobility).toEqual(
      RIDERS.find((r) => r.id === "r4")?.mobility_on_file,
    );
    expect(draft4?.expect.draftPickup).toBe(RIDERS.find((r) => r.id === "r4")?.home);
  });

  it("resolves the Nov 13 case to the day the fake service fails", () => {
    const year = CLOCK.now.getUTCFullYear();
    expect(vehicleServiceDown(`${year}-11-13`)).toBe(true);
    expect(AGENT_CASES.some((c) => c.note.includes("Nov 13"))).toBe(true);
  });
});
