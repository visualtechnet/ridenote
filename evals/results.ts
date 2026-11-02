import { writeFileSync } from "node:fs";
import type { Trip } from "../lib/trip";
import { costUsd } from "./prices";

/** One case in a results file: its verdict, its last answer, and what its attempts cost. */
export type CaseRow = {
  name: string;
  critical: boolean;
  tags: string[];
  pass: boolean;
  flaky: boolean;
  attempts: number;
  problems: string[];
  /** The last attempt's trip, or null when that request failed. Invented notes, so safe to keep. */
  answer: Trip | null;
  /** Summed over every attempt the case made. */
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

export type RunSummary = {
  model: string;
  promptVersion: string;
  date: string;
  cases: number;
  passed: number;
  passRate: number;
  criticalFailed: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costPerCaseUsd: number;
  /** Model calls made: a critical case makes three, an ordinary one makes one unless it fails. */
  calls: number;
  /** Per call, which is what a user waits for. The per-case figures add a case's attempts up. */
  meanLatencyPerCallMs: number;
  meanLatencyMs: number;
  medianLatencyMs: number;
};

/** A whole run: the summary first, so a reader sees the numbers before the rows. */
export type ResultsFile = RunSummary & { rows: CaseRow[] };

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summariseRun(
  rows: CaseRow[],
  model: string,
  promptVersion: string,
  date: string,
): RunSummary {
  const cases = rows.length;
  const passed = rows.filter((r) => r.pass).length;
  const inputTokens = rows.reduce((n, r) => n + r.inputTokens, 0);
  const outputTokens = rows.reduce((n, r) => n + r.outputTokens, 0);
  const cost = costUsd(model, inputTokens, outputTokens);
  const latencies = rows.map((r) => r.latencyMs);
  const calls = rows.reduce((n, r) => n + r.attempts, 0);
  const totalLatency = latencies.reduce((a, b) => a + b, 0);
  return {
    model,
    promptVersion,
    date,
    cases,
    passed,
    passRate: cases ? passed / cases : 0,
    criticalFailed: rows.filter((r) => r.critical && !r.pass).length,
    inputTokens,
    outputTokens,
    costUsd: cost,
    costPerCaseUsd: cases ? cost / cases : 0,
    calls,
    meanLatencyPerCallMs: calls ? totalLatency / calls : 0,
    meanLatencyMs: cases ? totalLatency / cases : 0,
    medianLatencyMs: median(latencies),
  };
}

/** evals/results/<date>-<model>[-<label>].json, relative to the repository root. */
export function resultsPath(date: string, model: string, label?: string): string {
  return `evals/results/${date}-${model}${label ? `-${label}` : ""}.json`;
}

export function writeResults(file: ResultsFile, path: string): void {
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
}
