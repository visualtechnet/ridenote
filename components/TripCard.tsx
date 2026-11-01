import type { ReactNode } from "react";
import {
  formatDate,
  formatTime12h,
  missingLabel,
  mobilityLabel,
  splitDateReason,
} from "@/lib/format";
import { MISSING_MOBILITY } from "@/lib/config";
import { COPY } from "@/lib/messages";
import type { Trip } from "@/lib/trip";
import type { Usage } from "@/lib/usage";

const BLANK =
  "inline-block min-w-28 border-b-2 border-dashed border-edge text-base text-zinc-400 italic";

const TAG = "font-mono border px-2 py-0.5 text-xs tracking-[0.14em] uppercase";

/** `hint` is a quiet line shown under "Not stated", for fields that are flagged but not chips. */
function Field({ label, value, hint }: { label: string; value: ReactNode | null; hint?: string }) {
  return (
    <div className="bg-panel min-w-0 p-4">
      <dt className="lab">{label}</dt>
      <dd className="mt-1.5">
        {value ? (
          <span className="font-mono text-base break-words text-zinc-50">{value}</span>
        ) : (
          <>
            <span className={BLANK}>{COPY.notStated}</span>
            {hint && <p className="text-missing mt-1.5 text-xs">{hint}</p>}
          </>
        )}
      </dd>
    </div>
  );
}

export function TripCard({ trip, usage }: { trip: Trip; usage?: Usage }) {
  // Mobility is flagged by the server (see missingFields), but as a quiet line beside the mobility
  // field rather than a chip: most notes name no aid, and a warning on nearly every card would be
  // ignored, including the ones that matter.
  const flagMobility = trip.missing_fields.includes(MISSING_MOBILITY);
  // A date the server cleared explains itself under the date field, not in an unlabelled note.
  const { dateReason, rest: notes } = splitDateReason(trip.notes);
  const chips = trip.missing_fields.filter((f) => f !== MISSING_MOBILITY);
  // One rule for every blank: a quiet line under it says so. The chips below are the summary.
  const hintFor = (field: string, label: string) =>
    trip.missing_fields.includes(field as Trip["missing_fields"][number])
      ? COPY.confirmField(label)
      : undefined;
  return (
    <section aria-label={COPY.resultLabel} className="bezel">
      <div className="border-etch border-b px-5 py-3.5">
        <h2 className="caps text-2xl break-words text-zinc-50">
          {trip.passenger_name ?? COPY.unknownPassenger}
        </h2>
        {hintFor("passenger_name", COPY.fieldPassenger) && (
          <p className="text-missing mt-1 text-xs">
            {hintFor("passenger_name", COPY.fieldPassenger)}
          </p>
        )}
      </div>

      <div className="p-5">
        <dl className="border-etch bg-etch grid gap-px border sm:grid-cols-2">
          <Field
            label={COPY.fieldPickup}
            value={trip.pickup_location}
            hint={hintFor("pickup_location", COPY.fieldPickup)}
          />
          <Field
            label={COPY.fieldDropoff}
            value={trip.dropoff_location}
            hint={hintFor("dropoff_location", COPY.fieldDropoff)}
          />
          {/* A missing date is a quiet line, like mobility, not a Missing chip: most notes give no
              date, and a chip on nearly every card would be ignored. */}
          <Field
            label={COPY.fieldPickupDate}
            hint={dateReason ?? COPY.confirmDate}
            value={
              trip.pickup_date && (
                <time dateTime={trip.pickup_date}>{formatDate(trip.pickup_date)}</time>
              )
            }
          />
          <Field
            label={COPY.fieldPickupTime}
            hint={hintFor("pickup_time", COPY.fieldPickupTime)}
            value={
              trip.pickup_time && (
                <time dateTime={trip.pickup_time}>{formatTime12h(trip.pickup_time)}</time>
              )
            }
          />
          <div className="bg-panel min-w-0 p-4 sm:col-span-2">
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

        {notes && (
          <p className="mt-5 text-sm break-words text-zinc-300">
            <span className="lab mr-2">{COPY.notesLabel}</span>
            <span>{notes}</span>
          </p>
        )}

        {chips.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="lab">{COPY.missingHeading}</span>
            <ul aria-label={COPY.missingListLabel} className="flex flex-wrap gap-2">
              {chips.map((f) => (
                <li key={f} className={`${TAG} border-missing-edge text-missing`}>
                  {missingLabel(f)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* For reviewers, not dispatchers (PRODUCT.md): folded away so the card reads as a trip. */}
        {usage && (
          <details className="mt-5">
            <summary className="lab focus-visible:outline-accent cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2">
              {COPY.usageLabel}
            </summary>
            <p className="mt-1.5 font-mono text-xs text-zinc-400">{COPY.usageValue(usage)}</p>
          </details>
        )}

        {/* Last and most visible: the one line every dispatcher must read. */}
        <p className="mt-5 text-sm text-zinc-200">{COPY.verifyReminder}</p>
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
