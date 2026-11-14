import { makeTrip } from "../tests/test-utils";
import { saveDraft, type HistoryRecord } from "./history";
import { createMemoryStore } from "./history-memory";
import { createPostgresStore, type QueryFn } from "./history-postgres";

const ENABLED = { VERCEL_ENV: "production", HISTORY_DATABASE_URL: "x" };
const record: HistoryRecord = {
  passenger_name: "Jo",
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
  pickup_date: "2026-11-03",
  pickup_time: "09:00",
  mobility: [],
};

describe("memory store insertDraft", () => {
  it("saves a draft once, then reports it as already saved", async () => {
    const store = createMemoryStore();
    expect(await store.insertDraft(record, "d1", 10)).toBe("saved");
    expect(await store.insertDraft(record, "d1", 10)).toBe("already_saved");
    expect(store.rows).toHaveLength(1);
  });

  it("refuses a new draft once the daily cap is reached", async () => {
    const store = createMemoryStore();
    expect(await store.insertDraft(record, "d1", 1)).toBe("saved");
    expect(await store.insertDraft(record, "d2", 1)).toBe("capped");
  });
});

describe("postgres store insertDraft", () => {
  const rowsFor = (inserted: number, already: boolean) =>
    jest.fn<ReturnType<QueryFn>, Parameters<QueryFn>>().mockResolvedValue({
      rows: [{ inserted, already }],
    });

  it("passes the draft id and the cap to one statement and reads saved", async () => {
    const query = rowsFor(1, false);
    const store = createPostgresStore("u", query);
    expect(await store.insertDraft(record, "d1", 10)).toBe("saved");
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("ON CONFLICT (draft_id) DO NOTHING");
    expect(sql).toContain("'agent'");
    expect(params.at(-2)).toBe("d1");
    expect(params.at(-1)).toBe(10);
  });

  it("reads already_saved when the draft exists, and capped when the cap stopped it", async () => {
    expect(await createPostgresStore("u", rowsFor(0, true)).insertDraft(record, "d1", 10)).toBe(
      "already_saved",
    );
    expect(await createPostgresStore("u", rowsFor(0, false)).insertDraft(record, "d1", 10)).toBe(
      "capped",
    );
  });

  it("reads capped when the statement returns no row at all", async () => {
    const query = jest
      .fn<ReturnType<QueryFn>, Parameters<QueryFn>>()
      .mockResolvedValue({ rows: [] });
    expect(await createPostgresStore("u", query).insertDraft(record, "d1", 10)).toBe("capped");
  });
});

describe("saveDraft", () => {
  it("is off outside production", async () => {
    expect(await saveDraft(makeTrip(), "d1", createMemoryStore())).toBe("off");
  });

  it("saves nothing for a trip with no text and no mobility", async () => {
    const empty = makeTrip({
      passenger_name: null,
      pickup_location: null,
      dropoff_location: null,
      mobility: [],
    });
    const original = process.env;
    process.env = { ...original, ...ENABLED };
    try {
      expect(await saveDraft(empty, "d1", createMemoryStore())).toBe("nothing");
    } finally {
      process.env = original;
    }
  });

  it("saves through the store when History is on", async () => {
    const original = process.env;
    process.env = { ...original, ...ENABLED };
    try {
      const store = createMemoryStore();
      expect(await saveDraft(makeTrip({ passenger_name: "Jo" }), "d1", store)).toBe("saved");
      expect(store.rows[0].pickup_location).toBe("12 Oak St");
    } finally {
      process.env = original;
    }
  });
});
