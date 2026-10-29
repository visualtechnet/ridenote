import type { ReactNode } from "react";
import { formatTime12h, mobilityLabel } from "@/lib/format";
import { MISSING_MOBILITY } from "@/lib/config";
import { COPY } from "@/lib/messages";
import type { Trip } from "@/lib/trip";
import type { Usage } from "@/lib/usage";

const BLANK =
  "inline-block min-w-28 border-b-2 border-dashed border-edge text-base text-zinc-400 italic";

const TAG = "font-mono border px-2 py-0.5 text-xs tracking-[0.14em] uppercase";

function Field({ label, value }: { label: string; value: ReactNode | null }) {
  return (
    <div className="bg-panel min-w-0 p-4">
      <dt className="lab">{label}</dt>
      <dd
        className={
          value ? "mt-1.5 font-mono text-base break-words text-zinc-50" : `mt-1.5 ${BLANK}`
        }
      >
        {value ?? COPY.notStated}
      </dd>
    </div>
  );
}

export function TripCard({ trip, usage }: { trip: Trip; usage?: Usage }) {
  // Mobility is flagged by the server (see missingFields), but as a quiet line beside the mobility
  // field rather than a chip: most notes name no aid, and a warning on nearly every card would be
  // ignored, including the ones that matter.
  const flagMobility = trip.missing_fields.includes(MISSING_MOBILITY);
  const chips = trip.missing_fields.filter((f) => f !== MISSING_MOBILITY);
  return (
    <section aria-label={COPY.resultLabel} className="bezel">
      <h2 className="caps border-etch border-b px-5 py-3.5 text-2xl break-words text-zinc-50">
        {trip.passenger_name ?? COPY.unknownPassenger}
      </h2>

      <div className="p-5">
        <dl className="border-etch bg-etch grid gap-px border sm:grid-cols-2">
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
          <div className="bg-panel min-w-0 p-4">
            <dt className="lab">{COPY.fieldMobility}</dt>
            <dd className="mt-1.5">
              {trip.mobility.length > 0 ? (
                <ul aria-label={COPY.mobilityListLabel} className="flex flex-wrap gap-2">
                  {trip.mobility.map((aid) => (
                    <li key={aid} className={`${TAG} border-accent text-accent`}>
                      {mobilityLabel(aid)}
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <span className={BLANK}>{COPY.notStated}</span>
                  {flagMobility && (
                    <p className="text-missing mt-1.5 text-xs">{COPY.confirmMobility}</p>
                  )}
                </>
              )}
            </dd>
          </div>
        </dl>

        {trip.notes && <p className="mt-5 text-sm break-words text-zinc-300">{trip.notes}</p>}

        <p className="mt-5 text-xs text-zinc-400">{COPY.verifyReminder}</p>

        {usage && (
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <span className="lab">{COPY.usageLabel}</span>
            <span className="font-mono text-xs text-zinc-400">{COPY.usageValue(usage)}</span>
          </p>
        )}

        {chips.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="lab">{COPY.missingHeading}</span>
            <ul aria-label={COPY.missingListLabel} className="flex flex-wrap gap-2">
              {chips.map((f) => (
                <li key={f} className={`${TAG} border-missing-edge text-missing`}>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export function TripCardSkeleton() {
  return (
    <div
      role="status"
      aria-label={COPY.loadingLabel}
      className="bezel p-5 motion-safe:animate-pulse"
    >
      <div className="bg-etch h-7 w-1/3" />
      <div className="mt-5 grid gap-px sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-etch h-14" />
        ))}
      </div>
    </div>
  );
}
