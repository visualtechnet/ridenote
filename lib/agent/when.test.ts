/** @jest-environment node */
import { makeTrip } from "../../tests/test-utils";
import { TOOL_ERRORS } from "./errors";
import { testContext } from "./test-context";
import { checkWhen } from "./when";

describe("checkWhen", () => {
  it("accepts tomorrow", () => {
    expect(checkWhen("2026-11-03", testContext())).toEqual({ ok: true });
  });

  it.each(["2026-11-01", "2027-02-01", "2026-02-30"])("the date %s is rejected", (d) => {
    const r = checkWhen(d, testContext());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Call ask_dispatcher to confirm the date\.$/);
  });

  it("rejects a date that is not on the weekday the note names", () => {
    expect(checkWhen("2026-11-03", testContext({ note: "Maria to dialysis Friday 9am" })).ok).toBe(
      false,
    );
  });

  it("refuses any date when the parse step found no date, even one that would otherwise pass", () => {
    const ctx = testContext({ parsed: makeTrip({ pickup_date: null }) });
    expect(checkWhen("2026-11-03", ctx)).toEqual({ ok: false, error: TOOL_ERRORS.dateNotStated });
  });

  it("keeps the normal checks when the parse step found a date", () => {
    const ctx = testContext({ parsed: makeTrip({ pickup_date: "2026-11-03" }) });
    expect(checkWhen("2026-11-03", ctx)).toEqual({ ok: true });
    expect(checkWhen("2026-11-01", ctx).ok).toBe(false);
  });
});
