/** Proof that a reservation was taken, so the same units can be given back later. */
export type Grant = { window: number; units: number };

/**
 * A fixed-window pool of model-call units. A run asks for its worst case up front and the pool
 * answers yes or no in one synchronous step, so two runs cannot both take the last units. When a
 * run finishes early, the unused units go back with `refund`, so a short run does not hold units
 * it never spent. A refund into a window that has already reset does nothing.
 */
export function createUnitBudget({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  let used = 0;
  let resetAt = 0;
  let window = 0;

  return {
    /** A grant when `units` were taken; null, taking nothing, when they do not fit this window. */
    reserve(units: number): Grant | null {
      const t = now();
      if (t >= resetAt) {
        used = 0;
        resetAt = t + windowMs;
        window += 1;
      }
      if (used + units > limit) return null;
      used += units;
      return { window, units };
    },
    /** Gives back `units` of a grant, at most what the grant took and only in the same window. */
    refund(units: number, grant: Grant): void {
      if (grant.window !== window || units <= 0) return;
      used = Math.max(0, used - Math.min(units, grant.units));
    },
    /** Whole seconds until the window resets, at least 1. */
    retryAfterSec(): number {
      return Math.max(1, Math.ceil((resetAt - now()) / 1000));
    },
  };
}
