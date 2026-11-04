import { isRealDate } from "./clock";
import type { MOBILITY } from "./config";
import { COPY, MESSAGES } from "./messages";

const TIME_24H = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * "09:30" becomes "9:30 AM" and "16:15" becomes "4:15 PM". The API and the data stay 24-hour, which
 * cannot be misread; only what a person reads is converted. Anything that is not a valid 24-hour time
 * comes back unchanged, so a value is never hidden or mangled.
 */
export function formatTime12h(time: string): string {
  const match = TIME_24H.exec(time);
  if (!match) return time;
  const hour = Number(match[1]);
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 || 12}:${match[2]} ${suffix}`;
}

const DATE_LABEL = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * "2026-11-06" becomes "Fri, Nov 6, 2026". A date is a plain calendar day, so it is formatted in UTC
 * and never shifts by a day for the reader's zone. Anything that is not a date comes back unchanged.
 */
export function formatDate(date: string): string {
  return isRealDate(date) ? DATE_LABEL.format(new Date(`${date}T00:00:00Z`)) : date;
}

export function mobilityLabel(aid: (typeof MOBILITY)[number]): string {
  return COPY.mobilityLabels[aid];
}

/** "pickup_time" becomes "Pickup time". A field the copy does not know keeps its key, so nothing is hidden. */
export function missingLabel(field: string): string {
  return (COPY.fieldLabels as Record<string, string | undefined>)[field] ?? field;
}

const DATE_REASON_STARTS = ["Date ", "Note says "];

/**
 * When the server cleared the pickup date it put its reason first in notes (lib/extract.ts). The card
 * shows that reason under the date field, where the blank is, and the rest of the note on its own.
 * Only a note that starts like a reason and contains its ending is split, so the model's own words
 * are never cut.
 */
export function splitDateReason(notes: string): { dateReason: string | null; rest: string } {
  const end = notes.indexOf(MESSAGES.dateReasonEnd);
  if (end === -1 || !DATE_REASON_STARTS.some((start) => notes.startsWith(start))) {
    return { dateReason: null, rest: notes };
  }
  const cut = end + MESSAGES.dateReasonEnd.length;
  return { dateReason: notes.slice(0, cut), rest: notes.slice(cut).trim() };
}
