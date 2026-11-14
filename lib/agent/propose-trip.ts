import { z } from "zod";
import { AGENT } from "../config";
import { clampText, TripSchema, type Trip } from "../trip";
import { TOOL_ERRORS } from "./errors";
import { mergedMobility, mergeTrip } from "./merge";
import { riderById } from "./riders";
import { sign } from "./sign";
import { vehicleClassFor } from "./vehicles";
import type { MergedTrip, ToolContext, ToolDef, ToolResult } from "./types";
import { checkWhen } from "./when";

export type DraftPayload = {
  v: 1;
  kind: "draft";
  draft_id: string;
  run_id: string;
  trip: Trip;
  sources: MergedTrip["sources"];
  conflicts: MergedTrip["conflicts"];
  exp: number;
};

export const ProposeTripInput = z.strictObject({
  rider_id: z.string().min(1).max(AGENT.nameMax),
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickup_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reasons: z.array(z.string().min(1).max(AGENT.reasonMax)).max(AGENT.maxReasons),
});

export const proposeTripDef: ToolDef = {
  name: "propose_trip",
  description:
    "Propose one trip for a person to approve. This ends your work. Nothing is booked or saved. Pass the rider's id; the name, address and mobility are filled in for you from the note and the rider's file. Call it only after find_rider returned exactly one rider and check_vehicle_availability returned available true. Do not call it if the rider, the date, the time or the drop-off is unknown: call ask_dispatcher.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      rider_id: { type: "string", description: "An id returned by find_rider" },
      pickup_date: { type: "string", description: "YYYY-MM-DD" },
      pickup_time: { type: "string", description: "24-hour HH:MM, for example 09:30" },
      reasons: {
        type: "array",
        items: { type: "string", description: "A short reason" },
        description: "Up to 5 short reasons for this proposal",
      },
    },
    required: ["rider_id", "pickup_date", "pickup_time", "reasons"],
    additionalProperties: false,
  },
};

/** `reasons` are validated by the input schema and not stored: week 5 decides whether the page shows them. */
export function proposeTrip(input: z.infer<typeof ProposeTripInput>, ctx: ToolContext): ToolResult {
  const rider = riderById(ctx.riders, input.rider_id);
  if (!rider) return { content: TOOL_ERRORS.unknownRider(input.rider_id), is_error: true };
  const when = checkWhen(input.pickup_date, ctx);
  if (!when.ok) return { content: when.error, is_error: true };
  if (ctx.parsed.dropoff_location === null) {
    return { content: TOOL_ERRORS.dropoffMissing, is_error: true };
  }
  if (vehicleClassFor(mergedMobility(ctx.parsed, rider).mobility) === null) {
    return { content: TOOL_ERRORS.mobilityUnknown, is_error: true };
  }
  const merged = mergeTrip(ctx.parsed, rider, {
    pickup_date: input.pickup_date,
    pickup_time: input.pickup_time,
  });
  const valid = TripSchema.safeParse(merged.trip);
  if (!valid.success) {
    return {
      content: TOOL_ERRORS.invalidInput(
        "propose_trip",
        clampText(valid.error.issues[0].message, AGENT.issueMax),
      ),
      is_error: true,
    };
  }
  const draftId = ctx.newId();
  const payload: DraftPayload = {
    v: 1,
    kind: "draft",
    draft_id: draftId,
    run_id: ctx.runId,
    trip: merged.trip,
    sources: merged.sources,
    conflicts: merged.conflicts,
    exp: ctx.clock.now.getTime() + AGENT.tokenTtlMs,
  };
  const draft = sign(payload, ctx.secret);
  return {
    content: JSON.stringify({ draft_id: draftId }),
    end: { status: "proposed", draftId, draft, merged },
  };
}
