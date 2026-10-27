import { HISTORY } from "./config";
import { getMemoryStore } from "./history-memory";
import { REMOVED, scrubText } from "./scrub";
import type { Trip } from "./trip";

/** The only fields ever saved. The raw note, notes and missing_fields are never stored. */
export type HistoryRecord = {
  passenger_name: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_time: string | null;
  mobility: Trip["mobility"];
};

export type HistoryRow = HistoryRecord & { id: number; created_at: Date };

export interface HistoryStore {
  /** Returns false, saving nothing, when `dailyCap` rows were already saved in the last 24 hours. */
  insert(record: HistoryRecord, dailyCap: number): Promise<boolean>;
  /** Rows from the last `sinceDays` days, newest first, at most `limit`. */
  list(limit: number, sinceDays: number): Promise<HistoryRow[]>;
}

/** History is on only in production with a database configured; nowhere else is a connection opened. */
export function historyEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production" && Boolean(env.HISTORY_DATABASE_URL);
}

/** Maps a trip to what may be saved, or null when there is nothing worth saving. */
export function toRecord(trip: Trip): HistoryRecord | null {
  const record: HistoryRecord = {
    passenger_name: scrubText(trip.passenger_name),
    pickup_location: scrubText(trip.pickup_location),
    dropoff_location: scrubText(trip.dropoff_location),
    pickup_time: trip.pickup_time,
    mobility: trip.mobility,
  };
  const hasText = [
    record.passenger_name,
    record.pickup_location,
    record.dropoff_location,
    record.pickup_time,
  ].some((value) => value !== null && value !== REMOVED);
  return hasText || record.mobility.length > 0 ? record : null;
}

/** Saves a parsed trip. Never throws: a broken history must not change a parse. */
export async function saveEntry(trip: Trip, store?: HistoryStore): Promise<void> {
  try {
    if (!historyEnabled()) return;
    const record = toRecord(trip);
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
export function getStore(): HistoryStore {
  if (process.env.HISTORY_STORE === "memory") return getMemoryStore();
  throw new Error("no history store configured");
}
