import { DATES } from "./config";

/**
 * The one source of "now" for date handling. The API route builds it from the system clock and the
 * browser's time zone; tests and evals pin it, so a case written around "tomorrow" means the same
 * thing every day it runs. Nothing else reads the system clock.
 */
export type Clock = { now: Date; timeZone: string };

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** True when Intl knows the zone, which is the only test that matters: it is what formats with it. */
export function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/**
 * The browser's zone when it is a real IANA name within the length cap; otherwise the default.
 * The input is never echoed back or logged, so a bad value can only fall through to the default.
 */
export function resolveTimeZone(input: unknown): string {
  if (
    typeof input === "string" &&
    input.length > 0 &&
    input.length <= DATES.timeZoneMaxLength &&
    isTimeZone(input)
  ) {
    return input;
  }
  return DATES.defaultTimeZone;
}

/** The calendar date of `now` in the clock's zone, as YYYY-MM-DD. */
export function localDate(clock: Clock): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: clock.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(clock.now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** YYYY-MM-DD and a day that exists: 2026-02-30 and 2026-13-01 are not real dates. */
export function isRealDate(iso: string): boolean {
  if (!ISO_DATE.test(iso)) return false;
  const time = Date.parse(`${iso}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === iso;
}

/** The weekday a real YYYY-MM-DD date falls on. Dates are plain calendar days, so no zone applies. */
export function weekdayOf(iso: string): Weekday {
  return WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/** The real date `days` after (or, when negative, before) a real YYYY-MM-DD date. */
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
