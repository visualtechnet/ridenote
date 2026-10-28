import { formatTime12h, mobilityLabel } from "@/lib/format";
import type { HistoryRow } from "@/lib/history";
import { COPY } from "@/lib/messages";
import { rateCalls } from "@/lib/usage-compare";

const SAVED_AT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-zinc-900 dark:text-zinc-50">
        {value || <span className="text-zinc-500 italic dark:text-zinc-400">{COPY.notStated}</span>}
      </dd>
    </div>
  );
}

/** A read-only list of saved trips. Every value is rendered as text, never as markup. */
export function HistoryList({ rows }: { rows: HistoryRow[] }) {
  const { ratings, rated, medianTokens, medianLatencyMs } = rateCalls(rows);
  return (
    <>
      {rated > 0 && (
        <p className="mt-6 text-sm text-zinc-700 dark:text-zinc-300">
          {COPY.ratingSummary(rated, medianTokens, medianLatencyMs)}
        </p>
      )}
      <ol aria-label={COPY.historyListLabel} className="mt-6 flex flex-col gap-4">
        {rows.map((row) => (
          <li key={row.id}>
            <article className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="min-w-0 text-lg font-semibold break-words text-zinc-900 dark:text-zinc-50">
                  {row.passenger_name ?? COPY.unknownPassenger}
                </h2>
                {ratings.get(row.id) && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      ratings.get(row.id) === "problematic"
                        ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
                        : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                    }`}
                  >
                    {ratings.get(row.id) === "problematic"
                      ? COPY.ratingProblematic
                      : COPY.ratingEfficient}
                  </span>
                )}
              </div>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label={COPY.fieldPickup} value={row.pickup_location} />
                <Field label={COPY.fieldDropoff} value={row.dropoff_location} />
                <Field
                  label={COPY.fieldPickupTime}
                  value={row.pickup_time && formatTime12h(row.pickup_time)}
                />
                <Field
                  label={COPY.fieldMobility}
                  value={
                    row.mobility.length > 0 && (
                      <ul aria-label={COPY.mobilityListLabel} className="flex flex-wrap gap-2">
                        {row.mobility.map((aid) => (
                          <li
                            key={aid}
                            className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            {mobilityLabel(aid)}
                          </li>
                        ))}
                      </ul>
                    )
                  }
                />
              </dl>
              {row.input_tokens != null && row.output_tokens != null && row.latency_ms != null && (
                <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">{COPY.usageLabel}</span>{" "}
                  {COPY.usageValue({
                    inputTokens: row.input_tokens,
                    outputTokens: row.output_tokens,
                    latencyMs: row.latency_ms,
                  })}
                </p>
              )}
              <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-400">
                {COPY.historySaved}{" "}
                <time dateTime={row.created_at.toISOString()}>
                  {SAVED_AT.format(row.created_at)}
                </time>
              </p>
            </article>
          </li>
        ))}
      </ol>
    </>
  );
}
