import { HISTORY } from "./config";
import { getMemoryStore } from "./history-memory";
import { createPostgresStore } from "./history-postgres";
import { REMOVED, scrubText } from "./scrub";
import type { Trip } from "./trip";
import type { Usage } from "./usage";

/** The only fields ever saved. The raw note, notes and missing_fields are never stored. The usage
 * columns hold counts and milliseconds only; they are null on rows saved before they existed. */
export type HistoryRecord = {
  passenger_name: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_time: string | null;
  mobility: Trip["mobility"];
  input_tokens?: number | null;
  output_tokens?: number | null;
  latency_ms?: number | null;
};

export type HistoryRow = HistoryRecord & { id: number; created_at: Date };

export interface HistoryStore {
  /**
   * Returns false, saving nothing, when `dailyCap` rows were already saved in the last 24 hours.
   * The cap counts rows strictly newer than 24 hours.
   */
  insert(record: HistoryRecord, dailyCap: number): Promise<boolean>;
  /**
   * Rows from the last `sinceDays` days, newest first, at most `limit`. Inclusive: a row exactly
   * `sinceDays` old is returned; the purge deletes only strictly older rows.
   */
  list(limit: number, sinceDays: number): Promise<HistoryRow[]>;
}

/** History is on only in production with a database configured; nowhere else is a connection opened. */
export function historyEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production" && Boolean(env.HISTORY_DATABASE_URL);
}

/** Blank text is nothing: it is saved as null, never as an empty string. */
const orNull = (text: string | null) => (text?.trim() ? text : null);

/** True when something other than removed markers, punctuation and spaces is left to show. */
const hasContent = (text: string | null) =>
  text !== null && /[\p{L}\p{N}]/u.test(text.replaceAll(REMOVED, ""));

/** Maps a trip to what may be saved, or null when there is nothing worth saving. */
export function toRecord(trip: Trip, usage?: Usage): HistoryRecord | null {
  const record: HistoryRecord = {
    passenger_name: orNull(scrubText(trip.passenger_name)),
    pickup_location: orNull(scrubText(trip.pickup_location)),
    dropoff_location: orNull(scrubText(trip.dropoff_location)),
    pickup_time: trip.pickup_time,
    mobility: trip.mobility,
    input_tokens: usage?.inputTokens ?? null,
    output_tokens: usage?.outputTokens ?? null,
    latency_ms: usage?.latencyMs ?? null,
  };
  const hasText = [record.passenger_name, record.pickup_location, record.dropoff_location].some(
    hasContent,
  );
  return hasText || record.mobility.length > 0 ? record : null;
}

/** Saves a parsed trip. Never throws: a broken history must not change a parse. */
export async function saveEntry(trip: Trip, usage?: Usage, store?: HistoryStore): Promise<void> {
  try {
    if (!historyEnabled()) return;
    const record = toRecord(trip, usage);
    if (!record) return;
    await (store ?? getStore()).insert(record, HISTORY.dailySaveCap);
  } catch (err) {
    // The error type only: its message could carry entry contents.
    console.error("history save failed:", err instanceof Error ? err.name : "unknown");
  }
}

export type HistoryResult =
  { status: "disabled" } | { status: "ok"; rows: HistoryRow[] } | { status: "error" };

export async function loadHistory(store?: HistoryStore): Promise<HistoryResult> {
  if (!historyEnabled()) return { status: "disabled" };
  try {
    const rows = await (store ?? getStore()).list(HISTORY.pageRowCap, HISTORY.retentionDays);
    return { status: "ok", rows };
  } catch (err) {
    console.error("history load failed:", err instanceof Error ? err.name : "unknown");
    return { status: "error" };
  }
}

/** Built on first use, so importing this file never opens a connection. */
// HISTORY_STORE=memory is for tests and browser tests only; it is never set on Vercel.
export function getStore(): HistoryStore {
  if (process.env.HISTORY_STORE === "memory") return getMemoryStore();
  return createPostgresStore();
}
