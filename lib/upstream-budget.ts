import { BUDGET } from "./config";
import { createUnitBudget } from "./agent/budget";

/**
 * The one spending cap for paid model calls in this instance, shared by the parse route and the
 * agent routes. Both spend the same money, so they draw from the same pool: a flood of one cannot
 * leave the other unlimited. Concurrency gates stay separate on purpose (see the agent route).
 */
export const upstreamBudget = createUnitBudget({
  limit: BUDGET.maxCallsPerWindow,
  windowMs: BUDGET.windowMs,
});
