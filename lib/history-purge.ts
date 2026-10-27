import { getMemoryStore, type createMemoryStore } from "./history-memory";
import { neonQuery, type QueryFn } from "./history-postgres";

const DAY_MS = 86_400_000;

/**
 * The only module allowed to delete history rows (a test enforces it), and it uses the purge
 * role's connection, not the app's.
 */
export interface HistoryPurger {
  /** Deletes rows strictly older than `days` days; a row exactly at the cut-off is kept. Returns the count. */
  purgeOlderThan(days: number): Promise<number>;
}

export function createPostgresPurger(
  url: string = process.env.HISTORY_PURGE_DATABASE_URL!,
  query: QueryFn = neonQuery(url),
): HistoryPurger {
  return {
    async purgeOlderThan(days: number) {
      const { rows } = await query(
        "DELETE FROM history WHERE created_at < now() - make_interval(days => $1::int) RETURNING id",
        [days],
      );
      return rows.length;
    },
  };
}

export function createMemoryPurger(
  store: ReturnType<typeof createMemoryStore>,
  now: () => number = Date.now,
): HistoryPurger {
  return {
    async purgeOlderThan(days: number) {
      const cutoff = now() - days * DAY_MS;
      const before = store.rows.length;
      const kept = store.rows.filter((r) => r.created_at.getTime() >= cutoff);
      store.rows.splice(0, store.rows.length, ...kept);
      return before - kept.length;
    },
  };
}

/** Built on first use. HISTORY_STORE=memory is for tests only; it is never set on Vercel. */
export function getPurger(): HistoryPurger {
  if (process.env.HISTORY_STORE === "memory") return createMemoryPurger(getMemoryStore());
  return createPostgresPurger();
}
