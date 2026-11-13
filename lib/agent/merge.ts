import { missingFields, type Trip } from "../trip";
import type { FieldSource, MergedTrip, Rider } from "./types";

export type { FieldSource, MergedTrip } from "./types";

const HOME_PICKUP =
  /^(?:(?:his|her|their|the)\s+)?(?:home|house|usual(?:\s+(?:place|spot|pickup))?)$/;

/** True when the note leaves the pickup to the rider's file: nothing said, or "home" and its kin. */
export function usesHomePickup(pickup: string | null): boolean {
  return pickup === null || HOME_PICKUP.test(pickup.trim().toLowerCase());
}

/** The note's mobility wins; the rider's file fills a gap. A conflict is two non-empty, different sets. */
export function mergedMobility(
  parsed: Trip,
  rider: Rider,
): { mobility: Trip["mobility"]; source: FieldSource | "none"; conflict: boolean } {
  const fromNote = parsed.mobility;
  const fromFile = rider.mobility_on_file;
  const sameSet =
    fromNote.length === fromFile.length && fromNote.every((aid) => fromFile.includes(aid));
  const conflict = fromNote.length > 0 && fromFile.length > 0 && !sameSet;
  if (fromNote.length > 0) return { mobility: fromNote, source: "note", conflict };
  if (fromFile.length > 0) return { mobility: fromFile, source: "rider_file", conflict };
  return { mobility: [], source: "none", conflict };
}

/** Combines the parsed note with the rider's file. It does not validate: propose_trip runs TripSchema. */
export function mergeTrip(
  parsed: Trip,
  rider: Rider,
  when: { pickup_date: string; pickup_time: string },
): MergedTrip {
  const fromHome = usesHomePickup(parsed.pickup_location);
  const { mobility, source, conflict } = mergedMobility(parsed, rider);
  const trip = {
    passenger_name: rider.name,
    pickup_location: fromHome ? rider.home : parsed.pickup_location,
    dropoff_location: parsed.dropoff_location,
    pickup_date: when.pickup_date,
    pickup_time: when.pickup_time,
    mobility,
    notes: parsed.notes,
  };
  return {
    trip: { ...trip, missing_fields: missingFields(trip) },
    sources: { pickup: fromHome ? "rider_file" : "note", mobility: source },
    conflicts: conflict ? ["mobility"] : [],
  };
}
