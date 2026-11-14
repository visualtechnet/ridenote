import type { RunResult } from "../lib/agent/types";
import type { PathExpectation } from "./agent-cases";

const VEHICLE_TOOL = "check_vehicle_availability";
const PROPOSE_TOOL = "propose_trip";

/** Every tool call across all steps, in order. */
function allCalls(result: RunResult) {
  return result.steps.flatMap((s) => s.calls);
}

const show = (v: unknown) => JSON.stringify(v ?? null);

/** Returns what is wrong with a run's path against an expectation. Empty means it passed. Pure: no model call. */
export function scorePath(result: RunResult, expect: PathExpectation): string[] {
  if (result.status === "failed") return [`run failed: ${result.reason}`];
  if (result.status !== expect.ends) return [`ended ${result.status}, expected ${expect.ends}`];

  const problems: string[] = [];
  const names = allCalls(result).map((c) => c.name);

  if (expect.callsInOrder) {
    let at = 0;
    for (const name of names) if (name === expect.callsInOrder[at]) at += 1;
    if (at < expect.callsInOrder.length) {
      problems.push(
        `calls out of order: expected ${expect.callsInOrder.join(", ")} in that order, got ${names.join(", ")}`,
      );
    }
  }
  for (const name of expect.neverCall ?? []) {
    if (names.includes(name)) problems.push(`called ${name}, which it must never call`);
  }
  if (expect.maxSteps !== undefined && result.steps.length > expect.maxSteps) {
    problems.push(`took ${result.steps.length} steps, expected at most ${expect.maxSteps}`);
  }

  if (result.status === "needs_info") {
    const have = new Set(result.end.options.map((o) => o.rider_id));
    for (const id of expect.optionRiderIds ?? []) {
      if (!have.has(id)) problems.push(`options lack rider ${id}`);
    }
    if (expect.questionMatches) {
      const texts = [result.end.question, ...result.end.options.map((o) => o.label)];
      if (!texts.some((t) => expect.questionMatches?.test(t))) {
        problems.push(
          `question did not match ${expect.questionMatches}: asked ${show(result.end.question)} with options ${result.end.options.map((o) => o.label).join(", ")}`,
        );
      }
    }
    return problems;
  }

  const { merged } = result.end;
  if (expect.draftRiderId !== undefined) {
    // A merged trip carries no rider id, so read it from the propose_trip call that succeeded.
    const call = allCalls(result).find((c) => c.name === PROPOSE_TOOL && !c.is_error);
    const got = (call?.input as { rider_id?: unknown } | undefined)?.rider_id ?? null;
    if (got !== expect.draftRiderId) {
      problems.push(`draftRiderId: expected ${show(expect.draftRiderId)}, got ${show(got)}`);
    }
    // Any propose_trip for a different rider fails the run, even one the loop refused as errored.
    for (const c of allCalls(result)) {
      if (c.name !== PROPOSE_TOOL) continue;
      const id = (c.input as { rider_id?: unknown } | null | undefined)?.rider_id ?? null;
      if (id !== expect.draftRiderId) {
        problems.push(
          `proposed for another rider: ${show(id)}, expected only ${show(expect.draftRiderId)}`,
        );
      }
    }
  }
  if (expect.draftPassenger !== undefined && merged.trip.passenger_name !== expect.draftPassenger) {
    problems.push(
      `draftPassenger: expected ${show(expect.draftPassenger)}, got ${show(merged.trip.passenger_name)}`,
    );
  }
  if (expect.draftPickup !== undefined && merged.trip.pickup_location !== expect.draftPickup) {
    problems.push(
      `draftPickup: expected ${show(expect.draftPickup)}, got ${show(merged.trip.pickup_location)}`,
    );
  }
  if (expect.draftMobility !== undefined) {
    // The order of aids does not matter, only which aids they are.
    const want = [...expect.draftMobility].sort();
    const got = [...merged.trip.mobility].sort();
    if (want.join() !== got.join()) {
      problems.push(`draftMobility: expected [${want.join(", ")}], got [${got.join(", ")}]`);
    }
  }
  if (expect.pickupSource !== undefined && merged.sources.pickup !== expect.pickupSource) {
    problems.push(
      `pickupSource: expected ${show(expect.pickupSource)}, got ${show(merged.sources.pickup)}`,
    );
  }
  if (expect.conflict !== undefined && !merged.conflicts.includes(expect.conflict)) {
    problems.push(`conflict: expected a ${expect.conflict} conflict, got none`);
  }
  return problems;
}

/** True when a vehicle check came back available:true before any propose_trip call. */
export function checkedVehicle(result: RunResult): boolean {
  for (const call of allCalls(result)) {
    if (call.name === PROPOSE_TOOL) return false;
    if (call.name === VEHICLE_TOOL && !call.is_error && call.content.includes('"available":true')) {
      return true;
    }
  }
  return false;
}
