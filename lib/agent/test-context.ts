// Test helper only: tests import it; nothing under lib/ or app/ does.
import { makeTrip } from "../../tests/test-utils";
import { RIDERS } from "./riders";
import type { ToolContext } from "./types";

/** Monday Nov 2, 2026 is the evals' pinned day, so "tomorrow" is 2026-11-03. */
export function testContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    clock: { now: new Date("2026-11-02T15:00:00Z"), timeZone: "America/New_York" },
    note: "Maria to County Hospital tomorrow at 9am",
    parsed: makeTrip(),
    riders: RIDERS,
    secret: "test-secret-".repeat(4),
    runId: "run-1",
    newId: () => "draft-1",
    ...overrides,
  };
}
