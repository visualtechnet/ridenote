/** @jest-environment node */
import {
  addDays,
  isRealDate,
  isTimeZone,
  localDate,
  resolveTimeZone,
  weekdayOf,
  type Clock,
} from "./clock";
import { DATES } from "./config";

// 2026-11-02 at 15:00 UTC: a Monday morning on the US east coast, already Tuesday in Auckland.
const now = new Date("2026-11-02T15:00:00Z");

describe("resolveTimeZone", () => {
  it("accepts a real IANA zone", () => {
    expect(resolveTimeZone("Europe/Madrid")).toBe("Europe/Madrid");
    expect(resolveTimeZone("UTC")).toBe("UTC");
  });

  it.each([
    ["a made-up zone", "Mars/Olympus"],
    ["an empty string", ""],
    ["not a string", 42],
    ["undefined", undefined],
    ["a zone-shaped string over the length cap", `America/${"x".repeat(DATES.timeZoneMaxLength)}`],
  ])("falls back to the default for %s", (_name, input) => {
    expect(resolveTimeZone(input)).toBe(DATES.defaultTimeZone);
  });

  it("the default zone is itself real, so the fallback always works", () => {
    expect(isTimeZone(DATES.defaultTimeZone)).toBe(true);
  });
});

describe("localDate", () => {
  it("is the date in the clock's zone, not UTC", () => {
    expect(localDate({ now, timeZone: "America/New_York" })).toBe("2026-11-02");
    expect(localDate({ now, timeZone: "Pacific/Auckland" })).toBe("2026-11-03");
    expect(
      localDate({ now: new Date("2026-11-03T03:00:00Z"), timeZone: "America/Los_Angeles" }),
    ).toBe("2026-11-02");
  });

  it("pads month and day", () => {
    const clock: Clock = { now: new Date("2026-01-05T12:00:00Z"), timeZone: "UTC" };
    expect(localDate(clock)).toBe("2026-01-05");
  });
});

describe("isRealDate", () => {
  it.each(["2026-11-02", "2024-02-29", "2026-12-31", "2026-01-01"])("accepts %s", (iso) => {
    expect(isRealDate(iso)).toBe(true);
  });

  it.each([
    ["a day that does not exist", "2026-02-30"],
    ["a month that does not exist", "2026-13-01"],
    ["a non-leap year 29 February", "2026-02-29"],
    ["a day of zero", "2026-11-00"],
    ["the wrong shape", "11/02/2026"],
    ["a date with a time", "2026-11-02T09:30"],
    ["words", "tomorrow"],
    ["an empty string", ""],
  ])("rejects %s", (_name, iso) => {
    expect(isRealDate(iso)).toBe(false);
  });
});

describe("weekdayOf and addDays", () => {
  it("knows the weekday of a date", () => {
    expect(weekdayOf("2026-11-02")).toBe("Monday");
    expect(weekdayOf("2026-11-06")).toBe("Friday");
    expect(weekdayOf("2026-11-01")).toBe("Sunday");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-02", 1)).toBe("2026-11-03");
    expect(addDays("2026-11-02", 60)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});
