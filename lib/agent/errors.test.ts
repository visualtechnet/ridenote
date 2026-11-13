/** @jest-environment node */
import { TOOL_ERRORS } from "./errors";

describe("TOOL_ERRORS", () => {
  it("every message names a next action", () => {
    const messages = [
      TOOL_ERRORS.unknownTool("x"),
      TOOL_ERRORS.invalidInput("find_rider", "name is empty"),
      TOOL_ERRORS.noRider("x"),
      TOOL_ERRORS.unknownRider("x"),
      TOOL_ERRORS.mobilityUnknown,
      TOOL_ERRORS.serviceDown,
      TOOL_ERRORS.dateRejected("That date is in the past."),
      TOOL_ERRORS.dropoffMissing,
    ];
    for (const m of messages) expect(m).toMatch(/call|fix|use/i);
  });

  it("uses the exact wording from the design", () => {
    expect(TOOL_ERRORS.unknownTool("foo")).toBe(
      'Unknown tool "foo". Use one of: find_rider, check_vehicle_availability, propose_trip, ask_dispatcher.',
    );
    expect(TOOL_ERRORS.invalidInput("propose_trip", "rider_id is missing")).toBe(
      "Invalid input for propose_trip: rider_id is missing. Fix the input and call the tool again.",
    );
    expect(TOOL_ERRORS.noRider("Zed")).toBe(
      'No rider matches "Zed". Check the spelling, or call ask_dispatcher.',
    );
    expect(TOOL_ERRORS.unknownRider("r9")).toBe(
      'No rider has id "r9". Call find_rider first and use an id it returned.',
    );
    expect(TOOL_ERRORS.mobilityUnknown).toBe(
      'The trip\'s mobility is not stated, or is "other". Call ask_dispatcher to ask what the rider needs.',
    );
    expect(TOOL_ERRORS.serviceDown).toBe(
      "Vehicle service unavailable. Call the tool once more; if it fails again, call ask_dispatcher.",
    );
    expect(TOOL_ERRORS.dateRejected("That date is in the past.")).toBe(
      "That date is in the past. Call ask_dispatcher to confirm the date.",
    );
    expect(TOOL_ERRORS.dropoffMissing).toBe(
      "The note gives no drop-off. Call ask_dispatcher to ask where the rider is going.",
    );
  });

  it("cuts long names and ids before placing them in a message", () => {
    expect(TOOL_ERRORS.noRider("x".repeat(500)).length).toBeLessThan(200);
    expect(TOOL_ERRORS.unknownRider("y".repeat(500)).length).toBeLessThan(200);
    expect(TOOL_ERRORS.unknownTool("z".repeat(500)).length).toBeLessThan(250);
  });
});
