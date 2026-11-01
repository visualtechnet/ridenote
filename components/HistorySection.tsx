import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { HISTORY } from "@/lib/config";
import { loadHistory, type HistoryResult } from "@/lib/history";
import { COPY } from "@/lib/messages";
import { HistoryList } from "./HistoryList";

/**
 * The cached read. A failed load is thrown, not returned: a thrown error is never stored, while a
 * returned { status: "error" } would be kept for HISTORY.revalidateSec, so one cold start or dropped
 * connection would show "could not be loaded" to every visitor for a minute.
 */
export async function loadCached(): Promise<Exclude<HistoryResult, { status: "error" }>> {
  "use cache";
  cacheLife({ stale: HISTORY.revalidateSec, revalidate: HISTORY.revalidateSec, expire: 3600 });
  const result = await loadHistory();
  if (result.status === "error") throw new Error("history load failed");
  return result;
}

/** The uncached path keeps the error; the cached one turns the thrown error back into it. */
const failed = (): HistoryResult => ({ status: "error" });

/** The browser tests use the in-memory store and must see a new entry at once, so it is not cached. */
const shouldCache = () => process.env.HISTORY_STORE !== "memory";

/**
 * Waits for a real request first, so whether history is on is decided at run time and never frozen
 * at build time; the database read itself is cached for HISTORY.revalidateSec.
 */
export async function HistorySection() {
  await connection();
  const result = await (shouldCache() ? loadCached().catch(failed) : loadHistory());

  if (result.status === "disabled") {
    return <p className="mt-6 text-zinc-300">{COPY.historyDisabled}</p>;
  }
  if (result.status === "error") {
    return (
      <p role="alert" className="text-danger-ink mt-6">
        {COPY.historyError}
      </p>
    );
  }
  if (result.rows.length === 0) {
    return <p className="mt-6 text-zinc-300">{COPY.historyEmpty}</p>;
  }
  return <HistoryList rows={result.rows} />;
}
