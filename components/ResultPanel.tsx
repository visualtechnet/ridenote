import { TripCard, TripCardSkeleton } from "./TripCard";
import { COPY } from "@/lib/messages";
import type { Trip } from "@/lib/trip";
import type { Usage } from "@/lib/usage";

type Props = {
  pending: boolean;
  error: string | null;
  trip: Trip | undefined;
  usage?: Usage;
  stale?: boolean;
};

export function ResultPanel({ pending, error, trip, usage, stale = false }: Props) {
  return (
    <>
      {/* Errors use role="alert", so they sit outside the polite live region to avoid double announcements. */}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}
      <div data-testid="result-region" aria-live="polite" aria-busy={pending}>
        {pending && <TripCardSkeleton />}
        {trip && stale && (
          <p className="mb-2 text-sm text-amber-800 dark:text-amber-300">{COPY.staleResult}</p>
        )}
        {trip && <TripCard trip={trip} usage={usage} />}
      </div>
    </>
  );
}
