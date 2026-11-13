import { checkPickupDate } from "../dates";
import { TOOL_ERRORS } from "./errors";
import type { ToolContext } from "./types";

/** Judges a date by the same four checks Parse uses: real, written date, today to the window's end, named weekday. */
export function checkWhen(
  date: string,
  ctx: ToolContext,
): { ok: true } | { ok: false; error: string } {
  const checked = checkPickupDate(date, ctx.note, ctx.clock);
  if (checked.reason !== null)
    return { ok: false, error: TOOL_ERRORS.dateRejected(checked.reason) };
  return { ok: true };
}
