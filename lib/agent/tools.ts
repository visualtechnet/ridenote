import type { z } from "zod";
import { askDispatcher, askDispatcherDef, AskDispatcherInput } from "./ask-dispatcher";
import { checkVehicle, checkVehicleDef, CheckVehicleInput } from "./check-vehicle";
import { AGENT } from "../config";
import { clampText } from "../trip";
import { TOOL_ERRORS } from "./errors";
import { findRider, findRiderDef, FindRiderInput } from "./find-rider";
import { proposeTrip, proposeTripDef, ProposeTripInput } from "./propose-trip";
import type { ToolContext, ToolDef, ToolResult } from "./types";

type Tool = { schema: z.ZodType; run: (input: never, ctx: ToolContext) => ToolResult };

const TOOLS = new Map<string, Tool>([
  ["find_rider", { schema: FindRiderInput, run: findRider }],
  ["check_vehicle_availability", { schema: CheckVehicleInput, run: checkVehicle }],
  ["propose_trip", { schema: ProposeTripInput, run: proposeTrip }],
  ["ask_dispatcher", { schema: AskDispatcherInput, run: askDispatcher }],
]);

/** What the model is shown, in the order it is shown. */
export const TOOL_DEFS: readonly ToolDef[] = [
  findRiderDef,
  checkVehicleDef,
  proposeTripDef,
  askDispatcherDef,
];

/** A call to one of these ends the run. */
export const ENDING_TOOLS: ReadonlySet<string> = new Set(["propose_trip", "ask_dispatcher"]);

/**
 * The one entry point for a tool call from the model. It never throws: a bad name, bad input or a
 * tool that fails all come back as an error result the model can read.
 */
export function runTool(name: string, input: unknown, ctx: ToolContext): ToolResult {
  // The caller is a model, so `name` may not be a string whatever the type says.
  const tool = typeof name === "string" ? TOOLS.get(name) : undefined;
  if (tool === undefined) {
    return { content: TOOL_ERRORS.unknownTool(String(name)), is_error: true };
  }
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first.path.join(".");
    return {
      content: TOOL_ERRORS.invalidInput(
        name,
        clampText(`${path === "" ? "input" : path}: ${first.message}`, AGENT.issueMax),
      ),
      is_error: true,
    };
  }
  try {
    return tool.run(parsed.data as never, ctx);
  } catch {
    return { content: TOOL_ERRORS.invalidInput(name, "the tool could not run"), is_error: true };
  }
}
