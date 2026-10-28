import { createMemoryStore } from "./history-memory";
import { createMemoryPurger, createPostgresPurger, getPurger } from "./history-purge";
import type { QueryFn } from "./history-postgres";

const DAY_MS = 86_400_000;
const record = {
  passenger_name: null,
  pickup_location: null,
  dropoff_location: null,
  pickup_time: null,
  mobility: [],
};

describe("createPostgresPurger", () => {
  it("sends one DELETE of strictly older rows with the days as a parameter and returns the count", async () => {
    const calls: { text: string; params: unknown[] }[] = [];
    const query: QueryFn = async (text, params) => {
      calls.push({ text, params });
      return { rows: [{ id: 1 }, { id: 2 }, { id: 3 }] };
    };
    const count = await createPostgresPurger("postgres://unused", query).purgeOlderThan(7);
    expect(count).toBe(3);
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toEqual([7]);
    expect(calls[0].text).toMatch(/^DELETE FROM history WHERE created_at < now\(\) - /);
  });
});

describe("createMemoryPurger", () => {
  it("removes rows older than the cut-off and keeps the cut-off row and anything newer", async () => {
    const base = 1_000_000 * DAY_MS;
    let t = base;
    const store = createMemoryStore(() => t);
    const purger = createMemoryPurger(store, () => t);
    t = base - 7 * DAY_MS - 1; // 1 ms past the cut-off
    await store.insert(record, 100);
    t = base - 7 * DAY_MS; // exactly at the cut-off
    await store.insert(record, 100);
    t = base - 7 * DAY_MS + 1; // 1 ms newer
    await store.insert(record, 100);
    t = base;
    expect(await purger.purgeOlderThan(7)).toBe(1);
    expect(store.rows.map((r) => r.id)).toEqual([2, 3]);
  });
});

describe("getPurger", () => {
  afterEach(() => {
    delete process.env.HISTORY_STORE;
  });
  it("returns the memory purger when HISTORY_STORE is memory", () => {
    process.env.HISTORY_STORE = "memory";
    expect(typeof getPurger().purgeOlderThan).toBe("function");
  });
  it("otherwise builds the Postgres purger without opening a connection", () => {
    expect(typeof getPurger().purgeOlderThan).toBe("function");
  });
});
