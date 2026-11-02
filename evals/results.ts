import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

/** How runs on the same day rank: the kept "after" run, then a plain run, then "before", then attempts. */
function labelRank(fileName: string, date: string, model: string): number {
  const label = fileName
    .slice(`${date}-${model}`.length)
    .replace(/^-/, "")
    .replace(/\.json$/, "");
  if (label.includes("reverted")) return 3;
  if (label === "after") return 0;
  if (label === "") return 1;
  return 2;
}

/**
 * The newest committed run for a model, by the file's own date field, with same-day ties broken by
 * the label in the file name (see labelRank). Reverted attempts never win. Null when there is none.
 * The README guard reads this, so a claim there is always the latest evidence.
 */
export function latestResults(model: string, dir = "evals/results"): ResultsFile | null {
  if (!existsSync(dir)) return null;
  const candidates = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ name: f, file: JSON.parse(readFileSync(join(dir, f), "utf8")) as ResultsFile }))
    .filter((c) => c.file.model === model);
  candidates.sort(
    (a, b) =>
      b.file.date.localeCompare(a.file.date) ||
      labelRank(a.name, a.file.date, model) - labelRank(b.name, b.file.date, model) ||
      b.name.localeCompare(a.name),
  );
  return candidates[0]?.file ?? null;
}
