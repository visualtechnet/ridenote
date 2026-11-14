import { createUnitBudget } from "./budget";

describe("createUnitBudget", () => {
  it("takes units while they fit in the window", () => {
    const budget = createUnitBudget({ limit: 10, windowMs: 60_000, now: () => 0 });
    expect(budget.reserve(7)).toBe(true);
    expect(budget.reserve(3)).toBe(true);
  });

  it("refuses a reservation that does not fit, taking nothing", () => {
    const budget = createUnitBudget({ limit: 10, windowMs: 60_000, now: () => 0 });
    expect(budget.reserve(7)).toBe(true);
    expect(budget.reserve(4)).toBe(false);
    expect(budget.reserve(3)).toBe(true);
  });

  it("starts a new window after the old one ends", () => {
    let t = 0;
    const budget = createUnitBudget({ limit: 5, windowMs: 1000, now: () => t });
    expect(budget.reserve(5)).toBe(true);
    expect(budget.reserve(1)).toBe(false);
    t = 1000;
    expect(budget.reserve(5)).toBe(true);
  });

  it("says how many whole seconds until the window resets, at least one", () => {
    let t = 0;
    const budget = createUnitBudget({ limit: 1, windowMs: 60_000, now: () => t });
    budget.reserve(1);
    t = 59_500;
    expect(budget.retryAfterSec()).toBe(1);
    t = 30_000;
    expect(budget.retryAfterSec()).toBe(30);
  });
});
