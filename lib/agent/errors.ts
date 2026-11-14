import { AGENT } from "../config";
import { clampText } from "../trip";

const cut = (text: string) => clampText(text, AGENT.nameMax);

/** Every message says what went wrong and what to try next. Names and ids are cut before use. */
export const TOOL_ERRORS = {
  unknownTool: (name: string) =>
    `Unknown tool "${cut(name)}". Use one of: find_rider, check_vehicle_availability, propose_trip, ask_dispatcher.`,
  invalidInput: (tool: string, issue: string) =>
    `Invalid input for ${tool}: ${issue}. Fix the input and call the tool again.`,
  noRider: (name: string) =>
    `No rider matches "${cut(name)}". Check the spelling, or call ask_dispatcher.`,
  unknownRider: (id: string) =>
    `No rider has id "${cut(id)}". Call find_rider first and use an id it returned.`,
  notLookedUp: (id: string) =>
    `The id "${cut(id)}" was not returned by find_rider in this run. Call find_rider first.`,
  endedAlready: "A tool in this reply already ended the run. Do not call more tools.",
  mobilityUnknown:
    'The trip\'s mobility is not stated, or is "other". Call ask_dispatcher to ask what the rider needs.',
  serviceDown:
    "Vehicle service unavailable. Call the tool once more; if it fails again, call ask_dispatcher.",
  dateRejected: (reason: string) => `${reason} Call ask_dispatcher to confirm the date.`,
  dateNotStated: "The note gives no date. Call ask_dispatcher to ask which date the trip is for.",
  dropoffMissing:
    "The note gives no drop-off. Call ask_dispatcher to ask where the rider is going.",
} as const;
