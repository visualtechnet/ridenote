import type { MOBILITY } from "./config";
import { COPY } from "./messages";

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

export function mobilityLabel(aid: (typeof MOBILITY)[number]): string {
  return COPY.mobilityLabels[aid];
}
