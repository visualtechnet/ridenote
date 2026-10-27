/**
 * Caps how many things run at once. `tryAcquire` never waits: when the gate is full the caller
 * is turned away immediately instead of queueing up memory and time behind a slow upstream.
 */
export function createGate(max: number) {
  let active = 0;
  return {
    /** Returns a release function, or null when the gate is full. Release exactly once. */
    tryAcquire(): (() => void) | null {
      if (active >= max) return null;
      active += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active -= 1;
      };
    },
    get active() {
      return active;
    },
  };
}
