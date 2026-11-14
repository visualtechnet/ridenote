/** @jest-environment node */
/**
 * Live agent check: runs each case in agent-cases.ts against the real model (parse, then the agent
 * loop with the fixture riders) and scores the path. Costs cents to a dollar. Not part of `npm test`;
 * run `npm run eval:agent`.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { agentModelName, createAnthropicModel } from "../lib/agent/model";
import { AGENT_PROMPT_VERSION, agentSystemPrompt } from "../lib/agent/prompt";
import { extractTrip } from "../lib/extract";
import { AGENT_CASES, type AgentCase } from "./agent-cases";
import {
  agentResultsPath,
  formatTable,
  summariseAgentRun,
  writeAgentResults,
  type AgentRow,
} from "./agent-results";
import { overBudget, runAgentCase, type Attempted, type CaseDeps } from "./agent-run";
import { CLOCK, PASS_RATE_FLOOR } from "./cases";
import { PRICES, costUsd } from "./prices";
import { CRITICAL_RUNS, RETRIES, attempt, judge } from "./score";

const BATCH = 3;
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
type CaseResult = { case: AgentCase; problems: string[]; flaky?: boolean; attempts: number };

/** The same pass-rate arithmetic as score.ts summarise, for agent cases. */
function summarise(all: CaseResult[]) {
  const failed = all.filter((r) => r.problems.length > 0);
  const passRate = all.length ? (all.length - failed.length) / all.length : 0;
  return { passRate, failed };
}

const results: CaseResult[] = [];
const rows: AgentRow[] = [];

(hasKey ? describe : describe.skip)("agent accuracy (live model)", () => {
  beforeAll(async () => {
    const client = new Anthropic();
    const model = agentModelName(process.env);
    const priced = model in PRICES;
    const maxUsd = Number(process.env.EVAL_MAX_USD ?? "1");
    let spent = 0;
    if (!priced) console.log(`model ${model} is unpriced, so the spend guard is off`);

    const deps: CaseDeps = {
      parse: async (note) => {
        const out = await extractTrip(client, note, { clock: CLOCK });
        return out.ok
          ? {
              ok: true,
              trip: out.trip,
              inputTokens: out.meta.inputTokens,
              outputTokens: out.meta.outputTokens,
            }
          : { ok: false, error: out.error };
      },
      model: createAnthropicModel(client, { model, system: agentSystemPrompt(CLOCK) }),
    };

    for (let i = 0; i < AGENT_CASES.length; i += BATCH) {
      const batch = AGENT_CASES.slice(i, i + BATCH);
      const done = await Promise.all(
        batch.map(async (c): Promise<CaseResult> => {
          if (priced && overBudget(spent, maxUsd)) {
            const problems = [`skipped (budget): spent $${spent.toFixed(4)} of $${maxUsd}`];
            rows.push({
              name: c.name,
              critical: Boolean(c.critical),
              pass: false,
              flaky: false,
              attempts: 0,
              problems,
              ended: "skipped (budget)",
              steps: 0,
              tools: [],
              checkedVehicle: false,
              inputTokens: 0,
              outputTokens: 0,
              cacheRead: 0,
              latencyMs: 0,
            });
            return { case: c, problems, attempts: 0 };
          }
          const made: Attempted[] = [];
          const run = async (): Promise<string[]> => {
            const out = await runAgentCase(deps, c);
            made.push(out);
            return out.problems;
          };
          // A critical case runs three times and must pass all three; others are retried only after a failure.
          const attempts = c.critical
            ? await Promise.all(Array.from({ length: CRITICAL_RUNS }, () => attempt(run)))
            : [await attempt(run)];
          if (!c.critical && attempts[0].length > 0) {
            for (let n = 0; n < RETRIES; n++) attempts.push(await attempt(run));
          }
          const verdict = judge(attempts, c.critical);
          const sum = (pick: (a: Attempted["row"]) => number) =>
            made.reduce((n, a) => n + pick(a.row), 0);
          const inputTokens = sum((r) => r.inputTokens);
          const outputTokens = sum((r) => r.outputTokens);
          spent += costUsd(model, inputTokens, outputTokens);
          const last = made.at(-1)?.row;
          rows.push({
            name: c.name,
            critical: Boolean(c.critical),
            pass: verdict.problems.length === 0,
            flaky: Boolean(verdict.flaky),
            attempts: attempts.length,
            problems: verdict.problems,
            ended: last?.ended ?? "failed: no attempt",
            steps: last?.steps ?? 0,
            tools: last?.tools ?? [],
            checkedVehicle: last?.checkedVehicle ?? false,
            inputTokens,
            outputTokens,
            cacheRead: sum((r) => r.cacheRead),
            latencyMs: sum((r) => r.latencyMs),
          });
          return { case: c, ...verdict, attempts: attempts.length };
        }),
      );
      results.push(...done);
    }

    const { passRate, failed } = summarise(results);
    const flaky = results.filter((r) => r.flaky && r.problems.length === 0);
    const today = new Date().toISOString().slice(0, 10);
    const summary = summariseAgentRun(rows, model, AGENT_PROMPT_VERSION, today);
    const path = agentResultsPath(today, model, process.env.EVAL_LABEL);
    // A run where no request answered is not evidence about the model: write nothing.
    const written = rows.some((r) => r.inputTokens > 0 || r.outputTokens > 0);
    if (written) {
      mkdirSync(dirname(path), { recursive: true });
      writeAgentResults({ ...summary, rows }, path);
    }
    const cost = summary.costUsd === null ? "unpriced" : `$${summary.costUsd.toFixed(4)}`;
    console.log(
      `${formatTable(rows, model)}\n${flaky.map((f) => `FLAKY ${f.case.name}: passed, but not every run`).join("\n")}\n${failed.map((f) => `FAIL ${f.case.name}: ${f.problems.join("; ")}`).join("\n")}\nmodel ${model} (prompt ${AGENT_PROMPT_VERSION}): ${results.length - failed.length}/${results.length} passed (${Math.round(passRate * 100)}%), ${cost} for ${summary.calls} runs\n${written ? `results written to ${path}` : "no request answered, so no results file was written"}`,
    );
  }, 900_000);

  it.each(AGENT_CASES.filter((c) => c.critical).map((c) => [c.name]))("critical: %s", (name) => {
    const r = results.find((x) => x.case.name === name);
    expect(r?.problems).toEqual([]);
  });

  it(`passes at least ${PASS_RATE_FLOOR * 100}% of all cases`, () => {
    const { passRate, failed } = summarise(results);
    if (passRate < PASS_RATE_FLOOR) {
      const detail = failed.map((f) => `  ${f.case.name}: ${f.problems.join("; ")}`).join("\n");
      throw new Error(`pass rate ${passRate.toFixed(2)} is below ${PASS_RATE_FLOOR}\n${detail}`);
    }
  });
});

if (!hasKey) {
  it("needs ANTHROPIC_API_KEY (.env.local, or `npm run eval:agent:key` with the Keychain) to run the live eval", () => {
    throw new Error("ANTHROPIC_API_KEY is not set, so the live eval cannot run.");
  });
}
