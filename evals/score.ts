import type { Trip } from "../lib/trip";
import type { EvalCase, Expectation } from "./cases";

const TEXT_FIELDS = ["passenger_name", "pickup_location", "dropoff_location"] as const;

/** Returns what is wrong with a trip against an expectation. Empty means it passed. */
export function score(trip: Trip, expected: Expectation): string[] {
  const problems: string[] = [];

  for (const field of TEXT_FIELDS) {
    const want = expected[field];
    if (want === undefined) continue;
    const got = trip[field];
    if (want === null) {
      if (got !== null) problems.push(`${field}: expected null, got ${JSON.stringify(got)}`);
    } else if (got === null || !want.test(got)) {
      problems.push(`${field}: expected ${want}, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.pickup_time !== undefined && trip.pickup_time !== expected.pickup_time) {
    problems.push(
      `pickup_time: expected ${JSON.stringify(expected.pickup_time)}, got ${JSON.stringify(trip.pickup_time)}`,
    );
  }
  if (expected.mobility !== undefined && trip.mobility !== expected.mobility) {
    problems.push(`mobility: expected ${expected.mobility}, got ${trip.mobility}`);
  }
  for (const field of expected.missing ?? []) {
    if (!trip.missing_fields.includes(field)) problems.push(`missing_fields lacks ${field}`);
  }
  if (expected.missing?.length === 0 && trip.missing_fields.length > 0) {
    problems.push(`missing_fields: expected none, got ${trip.missing_fields.join(", ")}`);
  }
  if (expected.notes && !expected.notes.test(trip.notes)) {
    problems.push(`notes: expected ${expected.notes}, got ${JSON.stringify(trip.notes)}`);
  }
  return problems;
}

export type CaseResult = { case: EvalCase; problems: string[] };

export function summarise(results: CaseResult[], floor: number) {
  const failed = results.filter((r) => r.problems.length > 0);
  const passRate = results.length ? (results.length - failed.length) / results.length : 0;
  const criticalFailed = failed.filter((r) => r.case.critical);
  return { passRate, failed, criticalFailed, ok: criticalFailed.length === 0 && passRate >= floor };
}
