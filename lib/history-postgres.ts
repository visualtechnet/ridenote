import type { HistoryRecord, HistoryRow, HistoryStore } from "./history";

/** One parameterised statement. Tests pass a fake; production uses the Neon driver (see neonQuery). */
export type QueryFn = (text: string, params: unknown[]) => Promise<{ rows: unknown[] }>;

/**
 * Wraps the Neon driver. The driver is loaded on the first query, so importing this file (or
 * building a store) loads no driver and opens no connection.
 */
export function neonQuery(url: string): QueryFn {
  let sql: { query: (text: string, params: unknown[]) => Promise<unknown[]> } | undefined;
  return async (text, params) => {
    if (!sql) sql = (await import("@neondatabase/serverless")).neon(url);
    return { rows: await sql.query(text, params) };
  };
}

// ONE statement: the cap check and the insert cannot be separated by a concurrent save.
// The cap counts rows strictly newer than 24 hours (created_at > ...).
const INSERT_SQL = `INSERT INTO history (passenger_name, pickup_location, dropoff_location, pickup_time, mobility, input_tokens, output_tokens, latency_ms)
SELECT $1::text, $2::text, $3::text, $4::text, $5::text[], $6::int, $7::int, $8::int
WHERE (SELECT count(*) FROM history WHERE created_at > now() - interval '1 day') < $9::bigint
RETURNING id`;

// Inclusive cut-off (>=): the purge deletes only strictly older rows.
const LIST_SQL = `SELECT id, created_at, passenger_name, pickup_location, dropoff_location, pickup_time, mobility, input_tokens, output_tokens, latency_ms
FROM history
WHERE created_at >= now() - make_interval(days => $2::int)
ORDER BY created_at DESC, id DESC
LIMIT $1::int`;

type DbRow = {
  id: string | number;
  created_at: string | Date;
  passenger_name: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_time: string | null;
  mobility: HistoryRow["mobility"] | null;
  input_tokens: number | string | null;
  output_tokens: number | string | null;
  latency_ms: number | string | null;
};

const count = (v: number | string | null | undefined) => (v == null ? null : Number(v));

export function createPostgresStore(
  url: string = process.env.HISTORY_DATABASE_URL!,
  query: QueryFn = neonQuery(url),
): HistoryStore {
  return {
    async insert(record: HistoryRecord, dailyCap: number) {
      const { rows } = await query(INSERT_SQL, [
        record.passenger_name,
        record.pickup_location,
        record.dropoff_location,
        record.pickup_time,
        record.mobility,
        record.input_tokens ?? null,
        record.output_tokens ?? null,
        record.latency_ms ?? null,
        dailyCap,
      ]);
      return rows.length > 0;
    },
    async list(limit: number, sinceDays: number) {
      const { rows } = await query(LIST_SQL, [limit, sinceDays]);
      return (rows as DbRow[]).map((r) => ({
        id: Number(r.id),
        created_at: new Date(r.created_at),
        passenger_name: r.passenger_name,
        pickup_location: r.pickup_location,
        dropoff_location: r.dropoff_location,
        pickup_time: r.pickup_time,
        mobility: r.mobility ?? [],
        input_tokens: count(r.input_tokens),
        output_tokens: count(r.output_tokens),
        latency_ms: count(r.latency_ms),
      }));
    },
  };
}
