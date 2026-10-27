/** @jest-environment node */
import { createGate } from "./concurrency";

describe("createGate", () => {
  it("lets in up to max callers and turns the next one away", () => {
    const gate = createGate(2);
    expect(gate.tryAcquire()).not.toBeNull();
    expect(gate.tryAcquire()).not.toBeNull();
    expect(gate.tryAcquire()).toBeNull();
    expect(gate.active).toBe(2);
  });

  it("frees a slot when a caller releases", () => {
    const gate = createGate(1);
    const release = gate.tryAcquire()!;
    expect(gate.tryAcquire()).toBeNull();
    release();
    expect(gate.tryAcquire()).not.toBeNull();
  });

  it("ignores a second release from the same caller", () => {
    const gate = createGate(1);
    const release = gate.tryAcquire()!;
    release();
    release();
    expect(gate.active).toBe(0);
    gate.tryAcquire();
    expect(gate.tryAcquire()).toBeNull(); // still only one slot, not two
  });
});
