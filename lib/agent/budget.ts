/**
 * A fixed-window pool of model-call units shared by the agent routes in one instance. A run asks
 * for its worst case up front (every step plus the parse step) and the pool answers yes or no in
 * one synchronous step, so two runs cannot both take the last units.
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

  return {
    /** True when `units` were taken; false, taking nothing, when they do not fit this window. */
    reserve(units: number): boolean {
      const t = now();
      if (t >= resetAt) {
        used = 0;
        resetAt = t + windowMs;
      }
      if (used + units > limit) return false;
      used += units;
      return true;
    },
    /** Whole seconds until the window resets, at least 1. */
    retryAfterSec(): number {
      return Math.max(1, Math.ceil((resetAt - now()) / 1000));
    },
  };
}
