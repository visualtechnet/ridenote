/** @jest-environment node */
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
});
