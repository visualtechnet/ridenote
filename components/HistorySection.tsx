import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { HISTORY } from "@/lib/config";
import { loadHistory } from "@/lib/history";
import { COPY } from "@/lib/messages";
import { HistoryList } from "./HistoryList";

async function loadCached() {
  "use cache";
  cacheLife({ stale: HISTORY.revalidateSec, revalidate: HISTORY.revalidateSec, expire: 3600 });
  return loadHistory();
}

/** The browser tests use the in-memory store and must see a new entry at once, so it is not cached. */
const shouldCache = () => process.env.HISTORY_STORE !== "memory";

/**
 * Waits for a real request first, so whether history is on is decided at run time and never frozen
 * at build time; the database read itself is cached for HISTORY.revalidateSec.
 */
export async function HistorySection() {
  await connection();
  const result = await (shouldCache() ? loadCached() : loadHistory());

  if (result.status === "disabled") {
    return <p className="mt-6 text-zinc-300">{COPY.historyDisabled}</p>;
  }
  if (result.status === "error") {
    return (
      <p role="alert" className="mt-6 text-red-300">
        {COPY.historyError}
      </p>
    );
  }
  if (result.rows.length === 0) {
    return <p className="mt-6 text-zinc-300">{COPY.historyEmpty}</p>;
  }
  return <HistoryList rows={result.rows} />;
}
