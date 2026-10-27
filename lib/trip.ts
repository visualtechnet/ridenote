import { z } from "zod";
import { MOBILITY, OUTPUT_LIMITS, REQUIRED_TRIP_FIELDS } from "./config";

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
    .describe("24h HH:MM, or null if not stated"),
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

/** Derived from the data itself, so a confused or manipulated model cannot misreport it. */
export function missingFields(trip: Trip): string[] {
  return REQUIRED_TRIP_FIELDS.filter((f) => trip[f] === null);
}
