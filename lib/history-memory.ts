import type { HistoryRecord, HistoryRow, HistoryStore } from "./history";

const DAY_MS = 86_400_000;

/** A store that lives in memory, for tests and browser tests. Nothing here touches a database. */
export function createMemoryStore(
  now: () => number = Date.now,
): HistoryStore & { rows: HistoryRow[] } {
  const rows: HistoryRow[] = [];
  let nextId = 1;

  return {
    rows,
    async insert(record: HistoryRecord, dailyCap: number) {
      const since = now() - DAY_MS;
      const recent = rows.filter((r) => r.created_at.getTime() > since).length;
      if (recent >= dailyCap) return false;
      rows.push({ ...record, id: nextId++, created_at: new Date(now()) });
      return true;
    },
    async list(limit: number, sinceDays: number) {
      const cutoff = now() - sinceDays * DAY_MS;
      return rows
        .filter((r) => r.created_at.getTime() >= cutoff)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id - a.id)
        .slice(0, limit);
    },
  };
}

const globalForStore = globalThis as {
  __historyMemoryStore?: ReturnType<typeof createMemoryStore>;
};

/** One shared instance, kept on globalThis so dev reloads and separate route bundles see the same rows. */
export function getMemoryStore() {
  return (globalForStore.__historyMemoryStore ??= createMemoryStore());
}
