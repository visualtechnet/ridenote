/** @jest-environment node */
/**
 * The store's SQL against a real Postgres, as db/schema.sql creates it. The unit tests pass a fake
 * query and only look at the SQL text; this proves what the text does: the one-statement cap,
 * make_interval, to_char on the date, the text[] column, the purge, and that the two logins can do
 * only what they were granted. Not part of `npm test`: CI starts a Postgres service, runs the schema
 * and the migrations, then `npm run test:db` (see .github/workflows/ci.yml).
 */
import { Pool } from "pg";
import type { HistoryRecord } from "@/lib/history";
import { createPostgresStore, type QueryFn } from "@/lib/history-postgres";
import { createPostgresPurger } from "@/lib/history-purge";

const OWNER_URL = process.env.DATABASE_URL;
const APP_URL = process.env.DB_APP_URL;
const PURGE_URL = process.env.DB_PURGE_URL;
const configured = Boolean(OWNER_URL && APP_URL && PURGE_URL);

/** The store takes a query function, so the same SQL runs through the plain driver here. */
function connect(url: string) {
  const pool = new Pool({ connectionString: url });
  const query: QueryFn = async (text, params) => ({ rows: (await pool.query(text, params)).rows });
  return { pool, query };
}

const record: HistoryRecord = {
  passenger_name: "Ann",
  pickup_location: "1 Main St",
  dropoff_location: "Clinic",
  pickup_date: "2026-11-06",
  pickup_time: "09:30",
  mobility: ["wheelchair", "walker"],
  input_tokens: 120,
  output_tokens: 160,
  latency_ms: 842,
};

(configured ? describe : describe.skip)("history SQL against a real Postgres", () => {
  const owner = connect(OWNER_URL!);
  const app = connect(APP_URL!);
  const purge = connect(PURGE_URL!);
  const store = createPostgresStore(APP_URL!, app.query);
  const purger = createPostgresPurger(PURGE_URL!, purge.query);

  beforeEach(async () => {
    await owner.pool.query("TRUNCATE history");
  });

  afterAll(async () => {
    await Promise.all([owner.pool.end(), app.pool.end(), purge.pool.end()]);
  });

  it("saves a trip as the app login and lists it back: date as YYYY-MM-DD text, aids as an array, usage as numbers", async () => {
    expect(await store.insert(record, 100)).toBe(true);
    const rows = await store.list(10, 7);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      passenger_name: "Ann",
      pickup_location: "1 Main St",
      dropoff_location: "Clinic",
      pickup_date: "2026-11-06",
      pickup_time: "09:30",
      mobility: ["wheelchair", "walker"],
      input_tokens: 120,
      output_tokens: 160,
      latency_ms: 842,
    });
    expect(typeof rows[0].id).toBe("number");
    expect(rows[0].created_at).toBeInstanceOf(Date);
    expect(Date.now() - rows[0].created_at.getTime()).toBeLessThan(60_000);
  });

  it("keeps a null date, time and usage as null, and an empty aid list as an empty array", async () => {
    await store.insert(
      {
        ...record,
        pickup_date: null,
        pickup_time: null,
        mobility: [],
        input_tokens: null,
        output_tokens: null,
        latency_ms: null,
      },
      100,
    );
    const [row] = await store.list(10, 7);
    expect(row).toMatchObject({
      pickup_date: null,
      pickup_time: null,
      mobility: [],
      input_tokens: null,
      output_tokens: null,
      latency_ms: null,
    });
  });

  it("refuses the save once the daily cap is reached, counting only the last 24 hours", async () => {
    await owner.pool.query(
      "INSERT INTO history (passenger_name, created_at) VALUES ('yesterday', now() - interval '25 hours')",
    );
    expect(await store.insert(record, 1)).toBe(true);
    expect(await store.insert(record, 1)).toBe(false);
    const { rows } = await owner.pool.query("SELECT count(*)::int AS n FROM history");
    expect(rows[0].n).toBe(2);
  });

  it("lists newest first and no more than the limit", async () => {
    for (const name of ["First", "Second", "Third"]) {
      await store.insert({ ...record, passenger_name: name }, 100);
    }
    const rows = await store.list(2, 7);
    expect(rows.map((r) => r.passenger_name)).toEqual(["Third", "Second"]);
  });

  it("lists only the last N days (inclusive) and the purge login deletes only strictly older rows", async () => {
    await store.insert(record, 100);
    await owner.pool.query(
      `INSERT INTO history (passenger_name, created_at)
       VALUES ('old', now() - interval '8 days'), ('recent', now() - interval '6 days 23 hours')`,
    );
    const listed = await store.list(10, 7);
    expect(listed.map((r) => r.passenger_name)).toEqual(["Ann", "recent"]);

    expect(await purger.purgeOlderThan(7)).toBe(1);
    const { rows } = await owner.pool.query("SELECT passenger_name FROM history ORDER BY id");
    expect(rows.map((r) => r.passenger_name)).toEqual(["Ann", "recent"]);
  });

  it("the app login cannot delete or update, and the purge login cannot insert", async () => {
    await store.insert(record, 100);
    const denied = expect.objectContaining({ code: "42501" });
    await expect(app.pool.query("DELETE FROM history")).rejects.toEqual(denied);
    await expect(app.pool.query("UPDATE history SET passenger_name = 'x'")).rejects.toEqual(denied);
    await expect(
      purge.pool.query("INSERT INTO history (passenger_name) VALUES ('x')"),
    ).rejects.toEqual(denied);
    const { rows } = await owner.pool.query("SELECT passenger_name FROM history");
    expect(rows).toEqual([{ passenger_name: "Ann" }]);
  });
});

if (!configured) {
  it("needs DATABASE_URL, DB_APP_URL and DB_PURGE_URL (a real Postgres, as CI provides) to run", () => {
    throw new Error(
      "The database tests need DATABASE_URL, DB_APP_URL and DB_PURGE_URL; see ci.yml.",
    );
  });
}
