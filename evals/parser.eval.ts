/** @jest-environment node */
/**
 * Live accuracy check: sends each note in cases.ts to the real model through the same code the API
 * uses, and scores the answer. Costs a few cents per run. Not part of `npm test`; run `npm run eval`.
 */
import Anthropic from "@anthropic-ai/sdk";
import { extractTrip } from "../lib/extract";
import { UPSTREAM } from "../lib/config";
import { CASES, PASS_RATE_FLOOR } from "./cases";
import { RETRIES, attempt, judge, score, summarise, type Attempt, type CaseResult } from "./score";

const BATCH = 5;
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
const results: CaseResult[] = [];

(hasKey ? describe : describe.skip)("parser accuracy (live model)", () => {
  beforeAll(async () => {
    const client = new Anthropic();
    for (let i = 0; i < CASES.length; i += BATCH) {
      const batch = CASES.slice(i, i + BATCH);
      const done = await Promise.all(
        batch.map(async (c): Promise<CaseResult> => {
          const run = async (): Promise<Attempt> => {
            const out = await extractTrip(client, c.note);
            return out.ok ? score(out.trip, c.expect) : [`request failed: ${out.error}`];
          };
          const attempts = [await attempt(run)];
          // Only a failure is run again: a clean first answer needs no second opinion.
          if (attempts[0].length > 0) {
            for (let i = 0; i < RETRIES; i++) attempts.push(await attempt(run));
          }
          return { case: c, ...judge(attempts), attempts: attempts.length };
        }),
      );
      results.push(...done);
    }
    const model = process.env[UPSTREAM.modelEnvVar] ?? UPSTREAM.defaultModel;
    const { passRate, failed } = summarise(results, PASS_RATE_FLOOR);
    const flaky = results.filter((r) => r.flaky && r.problems.length === 0);
    console.log(
      `${flaky.map((f) => `FLAKY ${f.case.name}: passed, but not every run`).join("\n")}\n${failed.map((f) => `FAIL ${f.case.name}: ${f.problems.join("; ")}`).join("\n")}\nmodel ${model}: ${results.length - failed.length}/${results.length} passed (${Math.round(passRate * 100)}%)`,
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
