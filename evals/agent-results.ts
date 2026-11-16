import { writeFileSync } from "node:fs";
import { PRICES, costUsd } from "./prices";

/** One live agent case in a results file. Tokens and latency are summed over attempts; steps and tools are the last attempt's. */
export type AgentRow = {
  name: string;
  critical: boolean;
  pass: boolean;
  flaky: boolean;
  attempts: number;
  problems: string[];
  /** proposed, needs_info, "failed: <reason>", parse failed or skipped (budget). */
  ended: string;
  steps: number;
  tools: string[];
  checkedVehicle: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  latencyMs: number;
};

export type AgentRunSummary = {
  model: string;
  /** The model the parse call used (MODEL), which can differ from the agent's. */
  parseModel?: string;
  promptVersion: string;
  date: string;
  cases: number;
  passed: number;
  passRate: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** null when the model has no price, so a run never shows a made-up zero. */
  costUsd: number | null;
  meanStepsPerRun: number;
  meanLatencyMs: number;
};

export function summariseAgentRun(
  rows: AgentRow[],
  model: string,
  promptVersion: string,
  date: string,
  parseModel?: string,
): AgentRunSummary {
  const cases = rows.length;
  const passed = rows.filter((r) => r.pass).length;
  const sum = (pick: (r: AgentRow) => number) => rows.reduce((n, r) => n + pick(r), 0);
  const inputTokens = sum((r) => r.inputTokens);
  const outputTokens = sum((r) => r.outputTokens);
  return {
    model,
    ...(parseModel === undefined ? {} : { parseModel }),
    promptVersion,
    date,
    cases,
    passed,
    passRate: cases ? passed / cases : 0,
    calls: sum((r) => r.attempts),
    inputTokens,
    outputTokens,
    costUsd: Object.hasOwn(PRICES, model) ? costUsd(model, inputTokens, outputTokens) : null,
    meanStepsPerRun: cases ? sum((r) => r.steps) / cases : 0,
    meanLatencyMs: cases ? sum((r) => r.latencyMs) / cases : 0,
  };
}

/** evals/agent-results/<date>-<model>[-<label>].json, relative to the repository root. */
export function agentResultsPath(date: string, model: string, label?: string): string {
  return `evals/agent-results/${date}-${model}${label ? `-${label}` : ""}.json`;
}

export function writeAgentResults(
  file: AgentRunSummary & { rows: AgentRow[] },
  path: string,
): void {
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
}

/** One line per case; dollars come from the row's own tokens, or "unpriced" for a model with no price. */
export function formatTable(rows: AgentRow[], model: string): string {
  const priced = Object.hasOwn(PRICES, model);
  return rows
    .map((r) => {
      const dollars = priced
        ? `$${costUsd(model, r.inputTokens, r.outputTokens).toFixed(4)}`
        : "unpriced";
      const tokens = `${r.inputTokens + r.outputTokens} tok`;
      const flag = r.checkedVehicle ? "" : "  no vehicle check";
      return `${r.name}  ${r.steps} steps  ${tokens}  ${dollars}  ${r.latencyMs} ms  ${r.ended}  ${r.pass ? "PASS" : "FAIL"}${flag}`;
    })
    .join("\n");
}
