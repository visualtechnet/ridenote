/** @jest-environment node */
import type { Clock } from "./clock";
import { DATES } from "./config";
import { checkPickupDate, namedWeekdays, writtenDates } from "./dates";

// Monday 2026-11-02, 10:00 in New York.
const clock: Clock = { now: new Date("2026-11-02T15:00:00Z"), timeZone: "America/New_York" };
const note = "Pick up Mrs. Lee at 12 Oak St at 9:30am, to County Hospital.";

describe("namedWeekdays", () => {
  it("finds full names in any case, including plurals", () => {
    expect(namedWeekdays("friday 3pm")).toEqual(["Friday"]);
    expect(namedWeekdays("Every Tuesday and THURSDAY")).toEqual(["Tuesday", "Thursday"]);
    expect(namedWeekdays("Saturdays only")).toEqual(["Saturday"]);
  });

  it("finds capitalised short forms, with or without a full stop", () => {
    expect(namedWeekdays("Fri. 3pm")).toEqual(["Friday"]);
    expect(namedWeekdays("Thurs 9am")).toEqual(["Thursday"]);
    expect(namedWeekdays("Tue or Wed")).toEqual(["Tuesday", "Wednesday"]);
    expect(namedWeekdays("Mon, Thu, Sat, Sun")).toEqual([
      "Sunday",
      "Monday",
      "Thursday",
      "Saturday",
    ]);
  });

  it("does not read ordinary lowercase words as days", () => {
    expect(namedWeekdays("she sat in the sun room all mon")).toEqual([]);
    expect(namedWeekdays("wed to the clinic, a fri night")).toEqual([]);
  });

  it("does not match inside other words", () => {
    expect(namedWeekdays("Monroe St to Fridley Clinic, Sunnyside Ave")).toEqual([]);
  });

  it("is empty for a note with no weekday", () => {
    expect(namedWeekdays(note)).toEqual([]);
  });
});

describe("writtenDates", () => {
  it("finds month/day, month/day/year and ISO dates", () => {
    expect(writtenDates("On 11/5 at 2pm")).toEqual([
      { text: "11/5", month: 11, day: 5, year: null },
    ]);
    expect(writtenDates("On 11/05/2026 at 2pm")).toEqual([
      { text: "11/05/2026", month: 11, day: 5, year: 2026 },
    ]);
    expect(writtenDates("On 11/5/26")).toEqual([
      { text: "11/5/26", month: 11, day: 5, year: 2026 },
    ]);
    expect(writtenDates("On 2026-11-05")).toEqual([
      { text: "2026-11-05", month: 11, day: 5, year: 2026 },
    ]);
  });

  it("ignores numbers that cannot be a month and a day, and finds several", () => {
    expect(writtenDates("14/3 and 1/40 and 11/5 or 11/6")).toEqual([
      { text: "11/5", month: 11, day: 5, year: null },
      { text: "11/6", month: 11, day: 6, year: null },
    ]);
    expect(writtenDates("Apt 12/A, 9:30am")).toEqual([]);
  });
});

describe("checkPickupDate", () => {
  it("clears a date the model changed away from the one written in the note", () => {
    // The model "corrected" Friday 11/5 to the Friday, 11/6. The written date is the fact.
    expect(checkPickupDate("2026-11-06", "Mr. Chen, Friday 11/5 at 3pm", clock)).toEqual({
      date: null,
      reason: "Note says 11/5 but the date came back as 2026-11-06; confirm the date.",
    });
    expect(checkPickupDate("2026-11-05", "On 11/05/2027 at 3pm", clock).reason).toMatch(
      /Note says 11\/05\/2027/,
    );
  });

  it("keeps a date that matches the one written, with or without a year", () => {
    expect(checkPickupDate("2026-11-20", "On 11/20 at 2pm", clock).date).toBe("2026-11-20");
    expect(checkPickupDate("2026-11-20", "On 11/20/2026 at 2pm", clock).date).toBe("2026-11-20");
    expect(checkPickupDate("2026-11-20", "On 11/20 or 11/21 at 2pm", clock).date).toBe(
      "2026-11-20",
    );
  });

  it("passes a null date through with no reason", () => {
    expect(checkPickupDate(null, note, clock)).toEqual({ date: null, reason: null });
  });

  it("keeps today, tomorrow and the last day of the window", () => {
    expect(checkPickupDate("2026-11-02", note, clock)).toEqual({
      date: "2026-11-02",
      reason: null,
    });
    expect(checkPickupDate("2026-11-03", note, clock)).toEqual({
      date: "2026-11-03",
      reason: null,
    });
    // 60 days after 2026-11-02 is 2027-01-01.
    expect(checkPickupDate("2027-01-01", note, clock)).toEqual({
      date: "2027-01-01",
      reason: null,
    });
    expect(DATES.maxDaysAhead).toBe(60);
  });

  it("clears a date that is not a real calendar date, with a reason", () => {
    for (const bad of ["2026-02-30", "2026-13-01", "tomorrow", "11/03/2026"]) {
      const out = checkPickupDate(bad, note, clock);
      expect(out.date).toBeNull();
      expect(out.reason).toMatch(/not a real calendar date/);
      expect(out.reason).toContain(bad);
    }
  });

  it("clears a date that has already passed, with a reason", () => {
    expect(checkPickupDate("2026-11-01", note, clock)).toEqual({
      date: null,
      reason: expect.stringMatching(/2026-11-01.*already passed/),
    });
    expect(checkPickupDate("2026-03-14", note, clock).date).toBeNull();
  });

  it("clears a date more than the window away, with a reason that names the window", () => {
    expect(checkPickupDate("2027-01-02", note, clock)).toEqual({
      date: null,
      reason: expect.stringMatching(/2027-01-02.*more than 60 days/),
    });
  });

  it("today is the date in the dispatcher's zone, not in UTC", () => {
    // 2026-11-03 01:00 UTC is still the evening of 2026-11-02 in New York.
    const evening: Clock = { now: new Date("2026-11-03T01:00:00Z"), timeZone: "America/New_York" };
    expect(checkPickupDate("2026-11-02", note, evening).date).toBe("2026-11-02");
    expect(checkPickupDate("2026-11-02", note, { ...evening, timeZone: "UTC" }).date).toBeNull();
  });

  it("keeps a January date written in December: a year-less date means its next occurrence", () => {
    // Wednesday 2026-12-16. "1/5" resolves to 2027-01-05, 20 days ahead, so it stands.
    const december: Clock = { now: new Date("2026-12-16T15:00:00Z"), timeZone: "America/New_York" };
    expect(checkPickupDate("2027-01-05", "On 1/5 at 9am", december)).toEqual({
      date: "2027-01-05",
      reason: null,
    });
    // Had the model picked this year's 1/5 instead, the past-date check would catch it.
    expect(checkPickupDate("2026-01-05", "On 1/5 at 9am", december).reason).toMatch(
      /already passed/,
    );
  });

  it("keeps a date that falls on the weekday the note names", () => {
    expect(checkPickupDate("2026-11-06", "Mr. Chen, Friday 3pm, 88 Lake Rd.", clock)).toEqual({
      date: "2026-11-06",
      reason: null,
    });
  });

  it("clears a date that falls on a different weekday from the one named, saying both", () => {
    // 2026-11-05 is a Thursday.
    expect(checkPickupDate("2026-11-05", "Mr. Chen, Friday 11/5, 88 Lake Rd.", clock)).toEqual({
      date: null,
      reason: "Note says Friday but 2026-11-05 is a Thursday; confirm the date.",
    });
  });

  it("accepts any of several named weekdays", () => {
    const out = checkPickupDate("2026-11-05", "Thursday or Friday, 3pm", clock);
    expect(out).toEqual({ date: "2026-11-05", reason: null });
  });

  it("checks the window before the weekday, so a past Friday is reported as past", () => {
    const out = checkPickupDate("2026-10-30", "Friday 3pm", clock);
    expect(out.reason).toMatch(/already passed/);
  });
});
