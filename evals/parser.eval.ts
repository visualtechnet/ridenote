/** @jest-environment node */
/**
 * Live accuracy check: sends each note in cases.ts to the real model through the same code the API
 * uses, and scores the answer. Costs a few cents per run. Not part of `npm test`; run `npm run eval`.
 */
import Anthropic from "@anthropic-ai/sdk";
import { extractTrip, type CallMeta } from "../lib/extract";
import { UPSTREAM } from "../lib/config";
import { PROMPT_VERSION } from "../lib/prompt";
import type { Trip } from "../lib/trip";
import { CASES, CLOCK, PASS_RATE_FLOOR } from "./cases";
import {
  resultsPath,
  shouldWriteResults,
  summariseRun,
  writeResults,
  type CaseRow,
} from "./results";
import {
  CRITICAL_RUNS,
  RETRIES,
  attempt,
  judge,
  score,
  summarise,
  type Attempt,
  type CaseResult,
} from "./score";

const BATCH = 5;
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
const results: CaseResult[] = [];
const rows: CaseRow[] = [];

/** What one attempt produced besides its verdict: the answer and what the call cost. */
type Attempted = { problems: Attempt; meta?: CallMeta; trip?: Trip };

(hasKey ? describe : describe.skip)("parser accuracy (live model)", () => {
  beforeAll(async () => {
    const client = new Anthropic();
    for (let i = 0; i < CASES.length; i += BATCH) {
      const batch = CASES.slice(i, i + BATCH);
      const done = await Promise.all(
        batch.map(async (c): Promise<CaseResult> => {
          const made: Attempted[] = [];
          // The clock is pinned, so a case written around "tomorrow" means the same thing every day.
          // Each attempt keeps its answer and usage for the results file, not only its verdict.
          const run = async (): Promise<Attempt> => {
            const out = await extractTrip(client, c.note, { clock: CLOCK });
            const problems = out.ok ? score(out.trip, c.expect) : [`request failed: ${out.error}`];
            made.push({ problems, meta: out.meta, trip: out.ok ? out.trip : undefined });
            return problems;
          };
          // A critical case is always run three times and must pass all three. Any other case is run
          // again only after a failure: a clean first answer needs no second opinion.
          const attempts = c.critical
            ? await Promise.all(Array.from({ length: CRITICAL_RUNS }, () => attempt(run)))
            : [await attempt(run)];
          if (!c.critical && attempts[0].length > 0) {
            for (let i = 0; i < RETRIES; i++) attempts.push(await attempt(run));
          }
          const verdict = judge(attempts, c.critical);
          rows.push({
            name: c.name,
            critical: Boolean(c.critical),
            tags: [...(c.tags ?? [])],
            pass: verdict.problems.length === 0,
            flaky: verdict.flaky,
            attempts: attempts.length,
            problems: verdict.problems,
            answer: made.at(-1)?.trip ?? null,
            inputTokens: made.reduce((n, a) => n + (a.meta?.inputTokens ?? 0), 0),
            outputTokens: made.reduce((n, a) => n + (a.meta?.outputTokens ?? 0), 0),
            latencyMs: made.reduce((n, a) => n + (a.meta?.latencyMs ?? 0), 0),
          });
          return { case: c, ...verdict, attempts: attempts.length };
        }),
      );
      results.push(...done);
    }
    const model = process.env[UPSTREAM.modelEnvVar] ?? UPSTREAM.defaultModel;
    const { passRate, failed } = summarise(results, PASS_RATE_FLOOR);
    const flaky = results.filter((r) => r.flaky && r.problems.length === 0);
    // The run as evidence: committed, so a baseline is a file anyone can open, not a memory.
    const today = new Date().toISOString().slice(0, 10);
    const summary = summariseRun(rows, model, PROMPT_VERSION, today);
    const path = resultsPath(today, model, process.env.EVAL_LABEL);
    // A run where nothing answered is not evidence about the model: say so, write nothing.
    const written = shouldWriteResults(rows);
    if (written) writeResults({ ...summary, rows }, path);
    console.log(
      `${flaky.map((f) => `FLAKY ${f.case.name}: passed, but not every run`).join("\n")}\n${failed.map((f) => `FAIL ${f.case.name}: ${f.problems.join("; ")}`).join("\n")}\nmodel ${model} (prompt ${PROMPT_VERSION}): ${results.length - failed.length}/${results.length} passed (${Math.round(passRate * 100)}%), $${summary.costUsd.toFixed(4)} for ${summary.calls} calls, ${Math.round(summary.meanLatencyPerCallMs)} ms per call\n${written ? `results written to ${path}` : "no request answered, so no results file was written"}`,
    );
  }, 300_000);

  it.each(CASES.filter((c) => c.critical).map((c) => [c.name]))("critical: %s", (name) => {
    const r = results.find((x) => x.case.name === name);
    expect(r?.problems).toEqual([]);
  });

  it(`passes at least ${PASS_RATE_FLOOR * 100}% of all cases`, () => {
    const { passRate, failed } = summarise(results, PASS_RATE_FLOOR);
    if (passRate < PASS_RATE_FLOOR) {
      const detail = failed.map((f) => `  ${f.case.name}: ${f.problems.join("; ")}`).join("\n");
      throw new Error(`pass rate ${passRate.toFixed(2)} is below ${PASS_RATE_FLOOR}\n${detail}`);
    }
  });
});

if (!hasKey) {
  it("needs ANTHROPIC_API_KEY (.env.local, or `npm run eval:key` with the Keychain) to run the live eval", () => {
    throw new Error("ANTHROPIC_API_KEY is not set, so the live eval cannot run.");
  });
}
