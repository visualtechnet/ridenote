import { HISTORY } from "./config";
import {
  historyEnabled,
  loadHistory,
  saveEntry,
  toRecord,
  type HistoryRow,
  type HistoryStore,
} from "./history";
import type { Trip } from "./trip";

const trip = (over: Partial<Trip> = {}): Trip => ({
  passenger_name: "Ann Lee",
  pickup_location: "12 Oak St",
  dropoff_location: "General Hospital",
  pickup_time: "09:30",
  mobility: ["wheelchair"],
  missing_fields: ["x"],
  notes: "call 555-123-4567",
  ...over,
});

const emptyTrip = (over: Partial<Trip> = {}) =>
  trip({
    passenger_name: null,
    pickup_location: null,
    dropoff_location: null,
    pickup_time: null,
    mobility: [],
    ...over,
  });

const fakeStore = (over: Partial<HistoryStore> = {}): HistoryStore => ({
  insert: jest.fn().mockResolvedValue(true),
  list: jest.fn().mockResolvedValue([]),
  ...over,
});

const ENABLED = { VERCEL_ENV: "production", HISTORY_DATABASE_URL: "x" };

describe("historyEnabled", () => {
  it("is true only in production with a database URL", () => {
    expect(historyEnabled(ENABLED)).toBe(true);
    expect(historyEnabled({ VERCEL_ENV: "production" })).toBe(false);
    expect(historyEnabled({ VERCEL_ENV: "production", HISTORY_DATABASE_URL: "" })).toBe(false);
    expect(historyEnabled({ VERCEL_ENV: "preview", HISTORY_DATABASE_URL: "x" })).toBe(false);
    expect(historyEnabled({ VERCEL_ENV: "development", HISTORY_DATABASE_URL: "x" })).toBe(false);
    expect(historyEnabled({ HISTORY_DATABASE_URL: "x" })).toBe(false);
    expect(historyEnabled({})).toBe(false);
  });
});

describe("toRecord", () => {
  it("keeps exactly the five saved fields", () => {
    const record = toRecord(trip())!;
    expect(Object.keys(record).sort()).toEqual([
      "dropoff_location",
      "mobility",
      "passenger_name",
      "pickup_location",
      "pickup_time",
    ]);
    expect(record).not.toHaveProperty("notes");
    expect(record).not.toHaveProperty("missing_fields");
  });

  it("scrubs text and keeps ordinary addresses", () => {
    const record = toRecord(trip({ passenger_name: "ann@example.com" }))!;
    expect(record.passenger_name).toBe("[removed]");
    expect(record.pickup_location).toBe("12 Oak St");
  });

  it("returns null for a trip with nothing in it", () => {
    expect(toRecord(emptyTrip())).toBeNull();
  });

  it("returns null when everything that is left was scrubbed away", () => {
    expect(toRecord(emptyTrip({ passenger_name: "ann@example.com" }))).toBeNull();
    expect(
      toRecord(emptyTrip({ passenger_name: "ann@example.com", pickup_location: "[removed]" })),
    ).toBeNull();
  });

  it("returns null when what is left is only removed markers, punctuation and spaces", () => {
    expect(toRecord(emptyTrip({ passenger_name: "jane@x.com / 555-123-4567" }))).toBeNull();
    expect(
      toRecord(emptyTrip({ passenger_name: "ann@example.com", pickup_location: " - [removed], " })),
    ).toBeNull();
  });

  it("returns null for blank strings, and saves a blank field as null next to real text", () => {
    expect(toRecord(emptyTrip({ passenger_name: "", pickup_location: "   " }))).toBeNull();
    const record = toRecord(trip({ dropoff_location: "  " }))!;
    expect(record.dropoff_location).toBeNull();
    expect(record.pickup_location).toBe("12 Oak St");
  });

  it("returns null for a trip with only a pickup time", () => {
    expect(toRecord(emptyTrip({ pickup_time: "09:30" }))).toBeNull();
  });

  it("saves a trip that has only a mobility aid", () => {
    expect(toRecord(emptyTrip({ mobility: ["cane"] }))).toEqual({
      passenger_name: null,
      pickup_location: null,
      dropoff_location: null,
      pickup_time: null,
      mobility: ["cane"],
    });
  });
});

describe("saveEntry", () => {
  const original = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, ENABLED);
  });
  afterEach(() => {
    process.env = { ...original };
    jest.restoreAllMocks();
  });

  it("inserts the record once with the daily cap", async () => {
    const store = fakeStore();
    await saveEntry(trip(), store);
    expect(store.insert).toHaveBeenCalledTimes(1);
    expect(store.insert).toHaveBeenCalledWith(toRecord(trip()), HISTORY.dailySaveCap);
  });

  it("does nothing when there is nothing worth saving", async () => {
    const store = fakeStore();
    await saveEntry(emptyTrip(), store);
    expect(store.insert).not.toHaveBeenCalled();
  });

  it("does nothing for a trip with only a pickup time", async () => {
    const store = fakeStore();
    await saveEntry(emptyTrip({ pickup_time: "09:30" }), store);
    expect(store.insert).not.toHaveBeenCalled();
  });

  it("does nothing when history is disabled", async () => {
    process.env.VERCEL_ENV = "preview";
    const store = fakeStore();
    await saveEntry(trip(), store);
    expect(store.insert).not.toHaveBeenCalled();
  });

  it("never throws and logs only the error name", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom Ann Lee");
    err.name = "PgError";
    const store = fakeStore({ insert: jest.fn().mockRejectedValue(err) });
    await expect(saveEntry(trip(), store)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith("history save failed:", "PgError");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("Ann");
  });

  it("does not throw when no store is configured", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.HISTORY_STORE;
    await expect(saveEntry(trip())).resolves.toBeUndefined();
  });
});

describe("loadHistory", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    jest.restoreAllMocks();
  });

  it("reports disabled without touching the store", async () => {
    Object.assign(process.env, { VERCEL_ENV: "preview" });
    const store = fakeStore();
    expect(await loadHistory(store)).toEqual({ status: "disabled" });
    expect(store.list).not.toHaveBeenCalled();
  });

  it("returns the rows the store gives, newest first", async () => {
    Object.assign(process.env, ENABLED);
    const rows = [{ id: 2 }, { id: 1 }] as HistoryRow[];
    const store = fakeStore({ list: jest.fn().mockResolvedValue(rows) });
    expect(await loadHistory(store)).toEqual({ status: "ok", rows });
    expect(store.list).toHaveBeenCalledWith(HISTORY.pageRowCap, HISTORY.retentionDays);
  });

  it("reports an error when the store rejects", async () => {
    Object.assign(process.env, ENABLED);
    jest.spyOn(console, "error").mockImplementation(() => {});
    const store = fakeStore({ list: jest.fn().mockRejectedValue(new Error("down")) });
    expect(await loadHistory(store)).toEqual({ status: "error" });
  });
});
