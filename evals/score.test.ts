/** @jest-environment node */
import { validateNote } from "../lib/validation";
import type { Trip } from "../lib/trip";
import { CASES, CLOCK, PASS_RATE_FLOOR } from "./cases";
import { RETRIES, attempt, judge, score, summarise } from "./score";

const trip: Trip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: null,
  pickup_date: null,
  pickup_time: "09:30",
  mobility: [],
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

  it("include the date cases, each pinned to the eval clock", () => {
    const dated = CASES.filter((c) => c.expect.pickup_date !== undefined);
    expect(dated.length).toBeGreaterThanOrEqual(9);
    expect(CLOCK.timeZone).toBe("America/New_York");
    // Every expected date is within the window for the pinned clock, or null, or a pattern.
    for (const c of dated) {
      const want = c.expect.pickup_date;
      if (typeof want === "string") {
        expect(want >= "2026-11-02" && want <= "2027-01-01").toBe(true);
      }
    }
  });
});

describe("score", () => {
  it("passes a matching trip", () => {
    expect(
      score(trip, {
        passenger_name: /lee/i,
        dropoff_location: null,
        pickup_time: "09:30",
        mobility: [],
        missing: ["dropoff_location"],
        notes: /tomorrow/i,
      }),
    ).toEqual([]);
  });

  describe("pickup_date", () => {
    const dated = { ...trip, pickup_date: "2026-11-06" };

    it("passes an exact match, a pattern, or null when null is expected", () => {
      expect(score(dated, { pickup_date: "2026-11-06" })).toEqual([]);
      expect(score(dated, { pickup_date: /^2026-11-(06|13)$/ })).toEqual([]);
      expect(score(trip, { pickup_date: null })).toEqual([]);
    });

    it("reports a wrong date, a date where null was expected, and null where a date was expected", () => {
      expect(score(dated, { pickup_date: "2026-11-13" })).toEqual([
        'pickup_date: expected "2026-11-13", got "2026-11-06"',
      ]);
      expect(score(dated, { pickup_date: /^2026-12/ })).toEqual([
        'pickup_date: expected /^2026-12/, got "2026-11-06"',
      ]);
      expect(score(dated, { pickup_date: null })).toEqual([
        'pickup_date: expected null, got "2026-11-06"',
      ]);
      expect(score(trip, { pickup_date: "2026-11-06" })).toEqual([
        'pickup_date: expected "2026-11-06", got null',
      ]);
    });

    it("is not checked when the case says nothing about it", () => {
      expect(score(dated, { pickup_time: "09:30" })).toEqual([]);
    });
  });

  it("reports every kind of mismatch", () => {
    const problems = score(trip, {
      passenger_name: /chen/i,
      pickup_location: null,
      dropoff_location: /hospital/,
      pickup_time: null,
      mobility: ["wheelchair"],
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

  describe("mobility", () => {
    const withAids = (mobility: Trip["mobility"]) => ({ ...trip, mobility });

    it("ignores the order of the aids", () => {
      expect(score(withAids(["cane", "wheelchair"]), { mobility: ["wheelchair", "cane"] })).toEqual(
        [],
      );
    });

    it("fails when an aid is missing, extra, or wrong", () => {
      expect(score(withAids(["cane"]), { mobility: ["cane", "walker"] })).toHaveLength(1);
      expect(score(withAids(["cane", "walker"]), { mobility: ["cane"] })).toHaveLength(1);
      expect(score(withAids(["cane"]), { mobility: ["walker"] })).toHaveLength(1);
    });

    it("tells an empty list from an aid", () => {
      expect(score(withAids([]), { mobility: ["wheelchair"] })).toHaveLength(1);
      expect(score(withAids(["wheelchair"]), { mobility: [] })).toHaveLength(1);
    });

    it("does not change the answer it checks (sorting works on a copy)", () => {
      const aids: Trip["mobility"] = ["walker", "cane"];
      score(withAids(aids), { mobility: ["cane", "walker"] });
      expect(aids).toEqual(["walker", "cane"]);
    });
  });

  it("does not check fields it was not asked about", () => {
    expect(score(trip, { mobility: [] })).toEqual([]);
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

describe("judge (a failing case is run again, and passes if it passes most runs)", () => {
  const ok: string[] = [];
  const bad = ["pickup_time: expected 15:00, got null"];

  it("passes a case that passed its only run", () => {
    expect(judge([ok])).toEqual({ problems: [], flaky: false });
  });

  it("passes a case that failed once but passed the two re-runs, and marks it flaky", () => {
    expect(judge([bad, ok, ok])).toEqual({ problems: [], flaky: true });
  });

  it("passes at 2 of 3 whichever runs were good", () => {
    expect(judge([ok, bad, ok]).problems).toEqual([]);
    expect(judge([bad, ok, ok]).problems).toEqual([]);
  });

  it("fails a case that passed only 1 of 3 runs, reporting the last failure, and marks it flaky", () => {
    expect(judge([bad, bad, ok])).toEqual({ problems: bad, flaky: true });
  });

  it("fails a case that failed every run, and does not call it flaky", () => {
    expect(judge([bad, bad, bad])).toEqual({ problems: bad, flaky: false });
  });

  it("re-runs a failure exactly twice", () => {
    expect(RETRIES).toBe(2);
  });

  describe("a critical case must pass every run", () => {
    it("passes only when all three runs pass", () => {
      expect(judge([ok, ok, ok], true)).toEqual({ problems: [], flaky: false });
    });

    it("fails at 2 of 3, reporting the failure and marking it flaky", () => {
      expect(judge([ok, bad, ok], true)).toEqual({ problems: bad, flaky: true });
      expect(judge([bad, ok, ok], true)).toEqual({ problems: bad, flaky: true });
    });

    it("fails at 1 of 3 and at 0 of 3", () => {
      expect(judge([bad, bad, ok], true).problems).toEqual(bad);
      expect(judge([bad, bad, bad], true)).toEqual({ problems: bad, flaky: false });
    });

    it("is not satisfied by a single run (the runner must supply all three)", () => {
      expect(judge([ok], true).problems).toEqual(["critical case: expected 3 runs, got 1"]);
    });
  });
});

describe("attempt (one broken request must not sink the whole run)", () => {
  it("passes a result through", async () => {
    expect(await attempt(async () => ["a problem"])).toEqual(["a problem"]);
    expect(await attempt(async () => [])).toEqual([]);
  });

  it("turns a thrown error into a failed attempt, keeping only its first line", async () => {
    const result = await attempt(async () => {
      throw new Error("Failed to parse structured output\nsecond line with details");
    });
    expect(result).toEqual(["request failed: Failed to parse structured output"]);
  });

  it("copes with something thrown that is not an Error", async () => {
    expect(
      await attempt(async () => {
        throw "boom";
      }),
    ).toEqual(["request failed: unknown error"]);
  });
});
