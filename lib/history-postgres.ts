import type { DraftOutcome, HistoryRecord, HistoryRow, HistoryStore } from "./history";

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
const INSERT_SQL = `INSERT INTO history (passenger_name, pickup_location, dropoff_location, pickup_date, pickup_time, mobility, input_tokens, output_tokens, latency_ms)
SELECT $1::text, $2::text, $3::text, $4::date, $5::text, $6::text[], $7::int, $8::int, $9::int
WHERE (SELECT count(*) FROM history WHERE created_at > now() - interval '1 day') < $10::bigint
RETURNING id`;

// Approve: ONE statement, as above. The draft id is unique, so a replay inserts nothing (DO NOTHING).
// `existing` is read before the insert, so "already saved" is reported even when the cap is full.
const INSERT_DRAFT_SQL = `WITH recent AS (SELECT count(*) AS n FROM history WHERE created_at > now() - interval '1 day'),
existing AS (SELECT 1 FROM history WHERE draft_id = $10::text),
ins AS (
  INSERT INTO history (passenger_name, pickup_location, dropoff_location, pickup_date, pickup_time, mobility, input_tokens, output_tokens, latency_ms, source, draft_id)
  SELECT $1::text, $2::text, $3::text, $4::date, $5::text, $6::text[], $7::int, $8::int, $9::int, 'agent', $10::text
  FROM recent
  WHERE recent.n < $11::bigint AND NOT EXISTS (SELECT 1 FROM existing)
  ON CONFLICT (draft_id) DO NOTHING
  RETURNING id)
SELECT (SELECT count(*) FROM ins) AS inserted, EXISTS (SELECT 1 FROM existing) AS already`;

// Inclusive cut-off (>=): the purge deletes only strictly older rows.
// pickup_date comes back as text, so no driver turns a plain calendar day into a midnight in some zone.
const LIST_SQL = `SELECT id, created_at, passenger_name, pickup_location, dropoff_location, to_char(pickup_date, 'YYYY-MM-DD') AS pickup_date, pickup_time, mobility, input_tokens, output_tokens, latency_ms
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
  pickup_date: string | null;
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
        record.pickup_date,
        record.pickup_time,
        record.mobility,
        record.input_tokens ?? null,
        record.output_tokens ?? null,
        record.latency_ms ?? null,
        dailyCap,
      ]);
      return rows.length > 0;
    },
    async insertDraft(
      record: HistoryRecord,
      draftId: string,
      dailyCap: number,
    ): Promise<DraftOutcome> {
      const { rows } = await query(INSERT_DRAFT_SQL, [
        record.passenger_name,
        record.pickup_location,
        record.dropoff_location,
        record.pickup_date,
        record.pickup_time,
        record.mobility,
        record.input_tokens ?? null,
        record.output_tokens ?? null,
        record.latency_ms ?? null,
        draftId,
        dailyCap,
      ]);
      const row = rows[0] as { inserted: number | string; already: boolean } | undefined;
      if (Number(row?.inserted ?? 0) > 0) return "saved";
      return row?.already ? "already_saved" : "capped";
    },
    async list(limit: number, sinceDays: number) {
      const { rows } = await query(LIST_SQL, [limit, sinceDays]);
      return (rows as DbRow[]).map((r) => ({
        id: Number(r.id),
        created_at: new Date(r.created_at),
        passenger_name: r.passenger_name,
        pickup_location: r.pickup_location,
        dropoff_location: r.dropoff_location,
        pickup_date: r.pickup_date ?? null,
        pickup_time: r.pickup_time,
        mobility: r.mobility ?? [],
        input_tokens: count(r.input_tokens),
        output_tokens: count(r.output_tokens),
        latency_ms: count(r.latency_ms),
      }));
    },
  };
}
