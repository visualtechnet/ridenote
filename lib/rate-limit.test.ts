/** @jest-environment node */
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("never tracks more than maxKeys, evicting the oldest even when all are live", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 3, now: () => 0 });
    for (const k of ["a", "b", "c", "d"]) check(k);
    // "a" was evicted, so it is treated as new again instead of staying blocked
    expect(check("a").allowed).toBe(true);
  });

  it("allows up to the limit then blocks with a retry-after", () => {
    const t = 0;
    const check = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => t });
    expect(check("a").allowed).toBe(true);
    expect(check("a").allowed).toBe(true);
    const blocked = check("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);
  });

  it("tracks keys independently", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
    expect(check("a").allowed).toBe(true);
    expect(check("b").allowed).toBe(true);
    expect(check("a").allowed).toBe(false);
  });

  it("allows again once the window has passed", () => {
    let t = 0;
    const check = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
    check("a");
    expect(check("a").allowed).toBe(false);
    t = 1000;
    expect(check("a").allowed).toBe(true);
  });

  it("keeps counting a known key even when the table is full", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 60_000, maxKeys: 1, now: () => 0 });
    expect(check("only").allowed).toBe(true);
    expect(check("only").allowed).toBe(true);
    expect(check("only").allowed).toBe(false); // used to reset itself and allow forever
  });

  it("clears expired entries first when the table is full, keeping live ones", () => {
    let t = 0;
    const check = createRateLimiter({ limit: 1, windowMs: 100, maxKeys: 2, now: () => t });
    check("old");
    t = 50;
    check("live");
    t = 120; // "old" has expired, "live" has not
    check("new");
    expect(check("live").allowed).toBe(false); // survived the cleanup, still counted
  });
});
