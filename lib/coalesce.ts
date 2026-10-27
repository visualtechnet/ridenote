/**
 * Makes identical concurrent work run once. If ten people submit the same note at the same moment,
 * one upstream call serves all ten. Nothing is stored afterwards: the entry disappears the moment
 * the work finishes, so no note or result is kept in memory.
 *
 * The shared work is only cancelled when every caller waiting on it has gone away.
 */
export function createCoalescer<T>() {
  type Entry = { promise: Promise<T>; waiters: number; controller: AbortController };
  const inFlight = new Map<string, Entry>();

  return {
    run(key: string, work: (signal: AbortSignal) => Promise<T>, callerSignal: AbortSignal) {
      let entry = inFlight.get(key);
      if (!entry) {
        const controller = new AbortController();
        const created: Entry = {
          controller,
          waiters: 0,
          promise: work(controller.signal).finally(() => {
            if (inFlight.get(key) === created) inFlight.delete(key);
          }),
        };
        inFlight.set(key, created);
        entry = created;
      }

      const shared = entry;
      shared.waiters += 1;
      const leave = () => {
        shared.waiters -= 1;
        if (shared.waiters > 0) return;
        // Nobody is waiting any more: stop paying for it, and don't let newcomers join a dead call.
        if (inFlight.get(key) === shared) inFlight.delete(key);
        shared.controller.abort();
      };
      if (callerSignal.aborted) leave();
      else callerSignal.addEventListener("abort", leave, { once: true });

      return shared.promise.finally(() => callerSignal.removeEventListener("abort", leave));
    },
    get size() {
      return inFlight.size;
    },
  };
}
