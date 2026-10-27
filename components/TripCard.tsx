import type { ReactNode } from "react";
import { formatTime12h, mobilityLabel } from "@/lib/format";
import { COPY } from "@/lib/messages";
import type { Trip } from "@/lib/trip";

function Field({ label, value }: { label: string; value: ReactNode | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </dt>
      <dd
        className={
          value
            ? "mt-0.5 text-base break-words text-zinc-900 dark:text-zinc-50"
            : "mt-0.5 text-base text-zinc-500 italic dark:text-zinc-400"
        }
      >
        {value ?? COPY.notStated}
      </dd>
    </div>
  );
}

export function TripCard({ trip }: { trip: Trip }) {
  return (
    <section
      aria-label={COPY.resultLabel}
      className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-xl font-semibold break-words text-zinc-900 dark:text-zinc-50">
        {trip.passenger_name ?? COPY.unknownPassenger}
      </h2>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label={COPY.fieldPickup} value={trip.pickup_location} />
        <Field label={COPY.fieldDropoff} value={trip.dropoff_location} />
        <Field
          label={COPY.fieldPickupTime}
          value={
            trip.pickup_time && (
              <time dateTime={trip.pickup_time}>{formatTime12h(trip.pickup_time)}</time>
            )
          }
        />
        <div className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {COPY.fieldMobility}
          </dt>
          <dd className="mt-1">
            {trip.mobility.length > 0 ? (
              <ul aria-label={COPY.mobilityListLabel} className="flex flex-wrap gap-2">
                {trip.mobility.map((aid) => (
                  <li
                    key={aid}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {mobilityLabel(aid)}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-base text-zinc-500 italic dark:text-zinc-400">
                {COPY.notStated}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {trip.notes && (
        <p className="mt-5 text-sm break-words text-zinc-600 dark:text-zinc-400">{trip.notes}</p>
      )}

      <p className="mt-5 text-xs text-zinc-600 dark:text-zinc-400">{COPY.verifyReminder}</p>

      {trip.missing_fields.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {COPY.missingHeading}
          </span>
          <ul aria-label={COPY.missingListLabel} className="flex flex-wrap gap-2">
            {trip.missing_fields.map((f) => (
              <li
                key={f}
                className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
              >
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function TripCardSkeleton() {
  return (
    <div
      role="status"
      aria-label={COPY.loadingLabel}
      className="animate-pulse rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="h-6 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 rounded bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}
