import { addDays, isRealDate, localDate, weekdayOf, type Clock, type Weekday } from "./clock";
import { DATES } from "./config";
import { formatDate } from "./format";
import { MESSAGES } from "./messages";

/**
 * Weekday words a note may use. Full names match in any case ("friday", "Fridays"). The short forms
 * match only when capitalised ("Fri", "Thurs."), so "she sat down" and "the sun room" are not days.
 * "Sun Valley Clinic" still is, and the date is then cleared with a reason, which is the safe way round.
 */
const WEEKDAY_WORDS: ReadonlyArray<readonly [Weekday, RegExp, RegExp]> = [
  ["Sunday", /\bsundays?\b/i, /\bSun\b/],
  ["Monday", /\bmondays?\b/i, /\bMon\b/],
  ["Tuesday", /\btuesdays?\b/i, /\bTues?\b/],
  ["Wednesday", /\bwednesdays?\b/i, /\bWed\b/],
  ["Thursday", /\bthursdays?\b/i, /\bThu(?:rs?)?\b/],
  ["Friday", /\bfridays?\b/i, /\bFri\b/],
  ["Saturday", /\bsaturdays?\b/i, /\bSat\b/],
];

/** Every weekday the note names, in week order. Empty when it names none. */
export function namedWeekdays(note: string): Weekday[] {
  return WEEKDAY_WORDS.filter(([, full, short]) => full.test(note) || short.test(note)).map(
    ([day]) => day,
  );
}

/**
 * A numeric date written in the note: 11/5, 11/5/26, 11/05/2026 or 2026-11-05. Month-first, as US
 * dispatchers write it. A year of two digits is this century. Anything that cannot be a month and a
 * day (14/3, 1/40) is left alone, since it is not a date.
 */
export type WrittenDate = { text: string; month: number; day: number; year: number | null };

const SLASH_DATE = /(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])/g;
const DASH_DATE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;

export function writtenDates(note: string): WrittenDate[] {
  const found: WrittenDate[] = [];
  for (const m of note.matchAll(SLASH_DATE)) {
    const [text, mm, dd, yy] = m;
    const month = Number(mm);
    const day = Number(dd);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const year = yy === undefined ? null : yy.length === 4 ? Number(yy) : 2000 + Number(yy);
    found.push({ text, month, day, year });
  }
  for (const m of note.matchAll(DASH_DATE)) {
    const [text, yyyy, mm, dd] = m;
    found.push({ text, month: Number(mm), day: Number(dd), year: Number(yyyy) });
  }
  return found;
}

/** True when a real YYYY-MM-DD date is the one written (the year only when the note gave one). */
function matchesWritten(iso: string, written: WrittenDate): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  return (
    month === written.month &&
    day === written.day &&
    (written.year === null || year === written.year)
  );
}

export type DateCheck = { date: string | null; reason: string | null };

/**
 * Code, not the model, decides whether a resolved date can stand. A date that fails any check is
 * cleared and the reason is returned for the trip's notes, so the card shows "Not stated" plus why:
 * a wrong date is worse than no date. The checks, in order:
 *   1. it is a real calendar date (the schema only checks the shape);
 *   2. if the note writes a numeric date (11/5), the date is one of them;
 *   3. it falls between today and today + DATES.maxDaysAhead in the dispatcher's zone;
 *   4. if the note names a weekday, the date falls on one of the named days.
 */
export function checkPickupDate(date: string | null, note: string, clock: Clock): DateCheck {
  if (date === null) return { date: null, reason: null };
  if (!isRealDate(date)) return { date: null, reason: MESSAGES.dateNotReal(date) };
  // From here the date is real, so reasons name it the way the card does ("Fri, Nov 6, 2026").
  const shown = formatDate(date);

  // The model may "correct" a written date to fit a weekday ("Friday 11/5" becoming the 6th). A
  // written date is a fact: the resolved date has to be one of them.
  const written = writtenDates(note);
  if (written.length > 0 && !written.some((w) => matchesWritten(date, w))) {
    return {
      date: null,
      reason: MESSAGES.dateDisagrees(shown, written.map((w) => w.text).join(" or ")),
    };
  }

  const today = localDate(clock);
  if (date < today) return { date: null, reason: MESSAGES.datePast(shown) };
  if (date > addDays(today, DATES.maxDaysAhead)) {
    return { date: null, reason: MESSAGES.dateTooFar(shown, DATES.maxDaysAhead) };
  }

  const named = namedWeekdays(note);
  const actual = weekdayOf(date);
  if (named.length > 0 && !named.includes(actual)) {
    return { date: null, reason: MESSAGES.dateWeekdayMismatch(shown, named, actual) };
  }
  return { date, reason: null };
}
