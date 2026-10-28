import { createMemoryStore } from "./history-memory";
import type { HistoryRecord } from "./history";

const DAY = 86_400_000;
const rec = (name: string): HistoryRecord => ({
  passenger_name: name,
  pickup_location: null,
  dropoff_location: null,
  pickup_time: null,
  mobility: [],
});

describe("memory store", () => {
  it("refuses inserts past the daily cap until the oldest row is 24 hours old", async () => {
    let now = 1_000_000_000;
    const store = createMemoryStore(() => now);
    expect(await store.insert(rec("a"), 2)).toBe(true);
    now += 1000;
    expect(await store.insert(rec("b"), 2)).toBe(true);
    expect(await store.insert(rec("c"), 2)).toBe(false);
    now += DAY - 1001; // the first row is 1 ms short of 24 h old
    expect(await store.insert(rec("d"), 2)).toBe(false);
    now += 1;
    expect(await store.insert(rec("e"), 2)).toBe(true);
    expect(store.rows).toHaveLength(3);
  });

  it("excludes a row older than the window and includes one 1 ms inside it", async () => {
    let now = 10 * DAY;
    const store = createMemoryStore(() => now);
    await store.insert(rec("old"), 100);
    now += 7 * DAY + 1;
    await store.insert(rec("edge"), 100);
    // "old" is 7 days + 1 ms old
    expect((await store.list(10, 7)).map((r) => r.passenger_name)).toEqual(["edge"]);
    now -= 2; // "old" is now 7 days - 1 ms old
    expect((await store.list(10, 7)).map((r) => r.passenger_name)).toEqual(["edge", "old"]);
  });

  it("includes a row exactly sinceDays old", async () => {
    // Inclusive cut-off: Task 7's purge must delete only strictly older rows.
    let now = 10 * DAY;
    const store = createMemoryStore(() => now);
    await store.insert(rec("exact"), 100);
    now += 7 * DAY;
    expect((await store.list(10, 7)).map((r) => r.passenger_name)).toEqual(["exact"]);
  });

  it("lists newest first and honours the limit", async () => {
    let now = 5 * DAY;
    const store = createMemoryStore(() => now);
    for (const n of ["a", "b", "c"]) {
      await store.insert(rec(n), 100);
      now += 1000;
    }
    const rows = await store.list(2, 7);
    expect(rows.map((r) => r.passenger_name)).toEqual(["c", "b"]);
    expect(rows[0].created_at).toBeInstanceOf(Date);
  });
});
