import { createUnitBudget } from "./budget";

describe("createUnitBudget", () => {
  it("takes units while they fit in the window", () => {
    const budget = createUnitBudget({ limit: 10, windowMs: 60_000, now: () => 0 });
    expect(budget.reserve(7)).not.toBeNull();
    expect(budget.reserve(3)).not.toBeNull();
  });

  it("refuses a reservation that does not fit, taking nothing", () => {
    const budget = createUnitBudget({ limit: 10, windowMs: 60_000, now: () => 0 });
    expect(budget.reserve(7)).not.toBeNull();
    expect(budget.reserve(4)).toBeNull();
    expect(budget.reserve(3)).not.toBeNull();
  });

  it("starts a new window after the old one ends", () => {
    let t = 0;
    const budget = createUnitBudget({ limit: 5, windowMs: 1000, now: () => t });
    expect(budget.reserve(5)).not.toBeNull();
    expect(budget.reserve(1)).toBeNull();
    t = 1000;
    expect(budget.reserve(5)).not.toBeNull();
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

  it("gives back unused units, so a short run does not hold the rest of its worst case", () => {
    const budget = createUnitBudget({ limit: 10, windowMs: 60_000, now: () => 0 });
    const grant = budget.reserve(7);
    expect(grant).not.toBeNull();
    expect(budget.reserve(4)).toBeNull();
    budget.refund(5, grant!);
    expect(budget.reserve(4)).not.toBeNull();
  });

  it("never refunds more than the grant took", () => {
    const budget = createUnitBudget({ limit: 10, windowMs: 60_000, now: () => 0 });
    const grant = budget.reserve(2)!;
    budget.refund(50, grant);
    expect(budget.reserve(10)).not.toBeNull();
    expect(budget.reserve(1)).toBeNull();
  });

  it("ignores a refund into a window that has already reset", () => {
    let t = 0;
    const budget = createUnitBudget({ limit: 5, windowMs: 1000, now: () => t });
    const old = budget.reserve(5)!;
    t = 1000;
    expect(budget.reserve(5)).not.toBeNull(); // the new window is full
    budget.refund(5, old);
    expect(budget.reserve(1)).toBeNull(); // the refund did not free the new window
  });
});
