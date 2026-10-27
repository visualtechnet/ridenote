/** @jest-environment node */
import { validateNote } from "../lib/validation";
import type { Trip } from "../lib/trip";
import { CASES, PASS_RATE_FLOOR } from "./cases";
import { score, summarise } from "./score";

const trip: Trip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: null,
  pickup_time: "09:30",
  mobility: "unknown",
  missing_fields: ["dropoff_location"],
  notes: "Tomorrow.",
};

describe("eval cases", () => {
  it("have unique names", () => {
    const names = CASES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(CASES.map((c) => [c.name, c.note]))(
    "send a note the API would accept: %s",
    (_n, note) => {
      expect(validateNote(note).ok).toBe(true);
    },
  );

  it("each check something", () => {
    for (const c of CASES) expect(Object.keys(c.expect).length).toBeGreaterThan(0);
  });

  it("include critical cases for never-guess behaviour", () => {
    expect(CASES.filter((c) => c.critical).length).toBeGreaterThanOrEqual(10);
  });
});

describe("score", () => {
  it("passes a matching trip", () => {
    expect(
      score(trip, {
        passenger_name: /lee/i,
        dropoff_location: null,
        pickup_time: "09:30",
        mobility: "unknown",
        missing: ["dropoff_location"],
        notes: /tomorrow/i,
      }),
    ).toEqual([]);
  });

  it("reports every kind of mismatch", () => {
    const problems = score(trip, {
      passenger_name: /chen/i,
      pickup_location: null,
      dropoff_location: /hospital/,
      pickup_time: null,
      mobility: "wheelchair",
      missing: ["pickup_time"],
      notes: /friday/i,
    });
    expect(problems).toHaveLength(7);
  });

  it("treats a null where text was expected as a failure", () => {
    expect(score(trip, { dropoff_location: /hospital/ })).toHaveLength(1);
  });

  it("fails when nothing should be missing but something is", () => {
    expect(score(trip, { missing: [] })).toEqual([
      "missing_fields: expected none, got dropoff_location",
    ]);
  });

  it("does not check fields it was not asked about", () => {
    expect(score(trip, { mobility: "unknown" })).toEqual([]);
  });
});

describe("summarise", () => {
  const ok = { case: { name: "a", note: "n", expect: {} }, problems: [] };
  const bad = { case: { name: "b", note: "n", expect: {} }, problems: ["x"] };
  const badCritical = {
    case: { name: "c", note: "n", critical: true, expect: {} },
    problems: ["x"],
  };

  it("passes at or above the floor with no critical failure", () => {
    const results = [...Array(9).fill(ok), bad];
    expect(summarise(results, PASS_RATE_FLOOR)).toMatchObject({ passRate: 0.9, ok: true });
  });

  it("fails below the floor", () => {
    expect(summarise([ok, bad], PASS_RATE_FLOOR).ok).toBe(false);
  });

  it("fails on any critical failure even at a high pass rate", () => {
    const summary = summarise([...Array(99).fill(ok), badCritical], PASS_RATE_FLOOR);
    expect(summary.ok).toBe(false);
    expect(summary.criticalFailed).toHaveLength(1);
  });

  it("fails an empty run", () => {
    expect(summarise([], PASS_RATE_FLOOR).ok).toBe(false);
  });
});
