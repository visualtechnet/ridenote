/** @jest-environment node */
import { createCoalescer } from "./coalesce";

const never = new AbortController().signal;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("createCoalescer", () => {
  it("runs identical concurrent work once and gives every caller the result", async () => {
    const c = createCoalescer<string>();
    const d = deferred<string>();
    const work = jest.fn(() => d.promise);
    const all = [c.run("a", work, never), c.run("a", work, never), c.run("a", work, never)];
    d.resolve("done");
    expect(await Promise.all(all)).toEqual(["done", "done", "done"]);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("does not merge different keys", async () => {
    const c = createCoalescer<string>();
    const work = jest.fn(async () => "x");
    await Promise.all([c.run("a", work, never), c.run("b", work, never)]);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("keeps nothing afterwards: the next identical call runs again", async () => {
    const c = createCoalescer<string>();
    const work = jest.fn(async () => "x");
    await c.run("a", work, never);
    expect(c.size).toBe(0);
    await c.run("a", work, never);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("forgets a failed call so the next one can retry", async () => {
    const c = createCoalescer<string>();
    await expect(
      c.run("a", async () => Promise.reject(new Error("boom")), never),
    ).rejects.toThrow();
    expect(c.size).toBe(0);
  });

  it("cancels the shared work only when every caller has left", async () => {
    const c = createCoalescer<string>();
    const d = deferred<string>();
    let shared!: AbortSignal;
    const work = (signal: AbortSignal) => {
      shared = signal;
      return d.promise;
    };
    const one = new AbortController();
    const two = new AbortController();
    const p1 = c.run("a", work, one.signal);
    const p2 = c.run("a", work, two.signal);

    one.abort();
    expect(shared.aborted).toBe(false); // the second caller still needs it
    two.abort();
    expect(shared.aborted).toBe(true);
    expect(c.size).toBe(0);

    d.resolve("late");
    await Promise.all([p1, p2]);
  });

  it("does not let a new caller join work that was already cancelled", async () => {
    const c = createCoalescer<string>();
    const d = deferred<string>();
    const work = jest.fn(() => d.promise);
    const gone = new AbortController();
    const first = c.run("a", work, gone.signal);
    gone.abort();
    const second = c.run("a", work, never);
    expect(work).toHaveBeenCalledTimes(2);
    d.resolve("x");
    await Promise.all([first, second]);
  });

  it("treats a caller that is already aborted as having left", async () => {
    const c = createCoalescer<string>();
    let shared!: AbortSignal;
    const gone = new AbortController();
    gone.abort();
    await c.run("a", async (s) => ((shared = s), "x"), gone.signal);
    expect(shared.aborted).toBe(true);
  });
});
