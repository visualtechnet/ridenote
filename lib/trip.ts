import { z } from "zod";
import {
  MISSING_MOBILITY,
  MOBILITY,
  OUTPUT_LIMITS,
  REQUIRED_TRIP_FIELDS,
  type MissingField,
} from "./config";

const TIME_24H = /^([01]\d|2[0-3]):[0-5]\d$/;

// refine() rather than .max(): refinements stay out of the JSON Schema sent to the model, which
// only supports a subset of keywords, but still reject oversized output when we parse it.
const bounded = (max: number) => z.string().refine((s) => s.length <= max, `max ${max} characters`);

export const TripSchema = z.object({
  passenger_name: bounded(OUTPUT_LIMITS.name).nullable(),
  pickup_location: bounded(OUTPUT_LIMITS.location).nullable(),
  dropoff_location: bounded(OUTPUT_LIMITS.location).nullable(),
  pickup_time: z
    .string()
    .refine((v) => TIME_24H.test(v), "must be 24h HH:MM")
    .nullable()
    .describe(
      "24h HH:MM exactly as written in the note, with no time zone conversion; null if not stated",
    ),
  mobility: z
    .array(z.enum(MOBILITY))
    .max(OUTPUT_LIMITS.mobilityCount)
    .refine((aids) => new Set(aids).size === aids.length, "no repeats")
    .refine((aids) => !aids.includes("ambulatory") || aids.length === 1, "ambulatory stands alone")
    .describe("Every mobility aid the note names; [] if the note does not say"),
  missing_fields: z.array(bounded(OUTPUT_LIMITS.fieldName)).max(OUTPUT_LIMITS.missingFieldCount),
  notes: bounded(OUTPUT_LIMITS.notes).describe("One short sentence on anything ambiguous"),
});

export type Trip = z.infer<typeof TripSchema>;

/**
 * What the SDK parses the model's answer with. It describes exactly the same JSON to the model as
 * TripSchema, minus missing_fields (the server computes that, so the model is not asked for it and a
 * bad list from it cannot fail a note), and does not throw on two harmless slips: a notes line that runs long and a repeated
 * aid. The SDK throws on any failed rule, which used to turn a good note into a 502. Those two
 * are repaired by normalizeModelTrip; everything else is still checked by the strict TripSchema.
 */
export const ModelTripSchema = TripSchema.omit({ missing_fields: true }).extend({
  mobility: z
    .array(z.enum(MOBILITY))
    .max(OUTPUT_LIMITS.mobilityCount)
    .describe(TripSchema.shape.mobility.description ?? ""),
  notes: z.string().describe(TripSchema.shape.notes.description ?? ""),
});

/** Cuts text to at most `max` characters, ending in an ellipsis so a cut is visible. */
export function clampText(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Repairs the two harmless slips (see ModelTripSchema). Nothing else is touched, so a real problem,
 * such as a malformed time, a name over the limit, or "ambulatory" mixed with an aid, still fails
 * the strict TripSchema afterwards.
 */
export function normalizeModelTrip(trip: z.infer<typeof ModelTripSchema>) {
  return {
    ...trip,
    notes: clampText(trip.notes, OUTPUT_LIMITS.notes),
    mobility: [...new Set(trip.mobility)],
  };
}

/**
 * Derived from the data itself, so a confused or manipulated model cannot misreport it. Mobility is
 * included when the note named no aid: "not stated" is not the same as "needs none", and a wrong
 * guess means sending a vehicle that cannot carry the passenger. Walking unaided has to be stated.
 */
export function missingFields(
  trip: Pick<Trip, (typeof REQUIRED_TRIP_FIELDS)[number] | "mobility">,
) {
  const missing: MissingField[] = REQUIRED_TRIP_FIELDS.filter((f) => trip[f] === null);
  if (trip.mobility.length === 0) missing.push(MISSING_MOBILITY);
  return missing;
}
