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
  if (expected.mobility !== undefined) {
    // The order the note names aids in does not matter, only which aids they are.
    const want = [...expected.mobility].sort();
    const got = [...trip.mobility].sort();
    if (want.join() !== got.join()) {
      problems.push(`mobility: expected [${want.join(", ")}], got [${got.join(", ")}]`);
    }
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

/** One run of one case: what was wrong with the answer (empty means it passed). */
export type Attempt = string[];

export type CaseResult = {
  case: EvalCase;
  problems: string[];
  /** It passed some runs and failed others, so the model is not reliable on it. */
  flaky?: boolean;
  attempts?: number;
};

/** A failing case is run again this many more times before it is called a failure. */
export const RETRIES = 2;

/**
 * A model does not answer the same way every time, so one unlucky answer should not fail a case. A case
 * passes if it passes MORE THAN HALF of its runs (2 of 3). A case that passed some runs and failed
 * others is marked flaky, so unreliability is reported rather than hidden.
 */
export function judge(attempts: Attempt[]): { problems: string[]; flaky: boolean } {
  const passed = attempts.filter((a) => a.length === 0).length;
  const failedRuns = attempts.filter((a) => a.length > 0);
  const flaky = passed > 0 && failedRuns.length > 0;
  const passes = passed * 2 > attempts.length;
  return { problems: passes ? [] : (failedRuns.at(-1) ?? []), flaky };
}

export function summarise(results: CaseResult[], floor: number) {
  const failed = results.filter((r) => r.problems.length > 0);
  const passRate = results.length ? (results.length - failed.length) / results.length : 0;
  const criticalFailed = failed.filter((r) => r.case.critical);
  return { passRate, failed, criticalFailed, ok: criticalFailed.length === 0 && passRate >= floor };
}
