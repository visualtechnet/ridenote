import { z } from "zod";
import { AGENT } from "../config";
import { TOOL_ERRORS } from "./errors";
import { mergedMobility } from "./merge";
import { riderById } from "./riders";
import type { ToolContext, ToolDef, ToolResult } from "./types";
import { vehicleClassFor, vehicleServiceDown } from "./vehicles";
import { checkWhen } from "./when";

export const CheckVehicleInput = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  rider_id: z.string().min(1).max(AGENT.nameMax),
});

export const checkVehicleDef: ToolDef = {
  name: "check_vehicle_availability",
  description:
    "Check whether a vehicle that fits the rider is free at a date and time. The vehicle type is worked out for you from the trip's mobility. Returns available (true or false) and vehicle_class. Call it after find_rider has returned exactly one rider and you know the date and the time. Do not call it to look up a rider, and do not guess a date or time the note does not give.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      date: { type: "string", description: "YYYY-MM-DD" },
      time: { type: "string", description: "24-hour HH:MM, for example 09:30" },
      rider_id: { type: "string", description: "An id returned by find_rider" },
    },
    required: ["date", "time", "rider_id"],
    additionalProperties: false,
  },
};

export function checkVehicle(
  input: z.infer<typeof CheckVehicleInput>,
  ctx: ToolContext,
): ToolResult {
  const rider = riderById(ctx.riders, input.rider_id);
  if (!rider) return { content: TOOL_ERRORS.unknownRider(input.rider_id), is_error: true };
  const when = checkWhen(input.date, ctx);
  if (!when.ok) return { content: when.error, is_error: true };
  const vehicleClass = vehicleClassFor(mergedMobility(ctx.parsed, rider).mobility);
  if (vehicleClass === null) return { content: TOOL_ERRORS.mobilityUnknown, is_error: true };
  if (vehicleServiceDown(input.date)) return { content: TOOL_ERRORS.serviceDown, is_error: true };
  return { content: JSON.stringify({ available: true, vehicle_class: vehicleClass }) };
}
