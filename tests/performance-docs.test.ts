import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { AGENT, AGENT_RATE, BUDGET } from "@/lib/config";
import { slugify } from "@/lib/markdown";

const RESULTS = JSON.parse(
  readFileSync("evals/agent-results/2026-11-14-claude-haiku-5-5-final-pre-merge.json", "utf8"),
) as {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  meanStepsPerRun: number;
  rows: { attempts: number; steps: number; latencyMs: number }[];
};
const nearest10 = (n: number) => Math.round(n / 10) * 10;
const commas = (n: number) => n.toLocaleString("en-US");

describe("Performance docs", () => {
  it("has no docs/SCALING.md and nothing links to it", () => {
    expect(existsSync("docs/SCALING.md")).toBe(false);
    const files = execFileSync(
      "git",
      ["ls-files", "README.md", "docs", "app", "components", "lib"],
      {
        encoding: "utf8",
      },
    )
      .split("\n")
      .filter((f) => /\.(md|ts|tsx)$/.test(f) && !f.startsWith("docs/superpowers/"));
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.filter(
      (f) => existsSync(f) && readFileSync(f, "utf8").includes("SCALING.md"),
    );
    expect(offenders).toEqual([]);
  });

  const MOVED = [
    'What does 429 mean, and what does 503 mean? They both say "try later".',
    "Why do two people sending the same note at the same moment cost one AI call?",
    "Why does pressing Parse twice on the same note do nothing?",
    "Why does the rate limit behave oddly on my machine?",
    "Can I change the limits?",
    'It says "This demo has used up its AI budget". What now?',
    "Is it safe to leave the public demo running?",
  ];

  it("keeps the seven moved questions in Performance and links to them from the FAQ", () => {
    const perf = readFileSync("docs/PERFORMANCE.md", "utf8");
    const faq = readFileSync("docs/FAQ.md", "utf8");
    expect(perf).toContain("## Questions about limits and cost");
    for (const q of MOVED) {
      expect(perf).toContain(`### ${q}`);
      // The demo-safety question keeps its safety half in the FAQ, so its heading stays there.
      if (!q.startsWith("Is it safe")) expect(faq).not.toContain(`### ${q}`);
    }
    const links = faq.match(/\/docs\/performance#[a-z0-9-]+/g) ?? [];
    expect(new Set(links).size).toBeGreaterThanOrEqual(7);
    for (const q of MOVED) expect(links).toContain(`/docs/performance#${slugify(q)}`);
  });

  it("every FAQ link into Performance points at a heading that exists", () => {
    const perf = readFileSync("docs/PERFORMANCE.md", "utf8");
    const ids = perf
      .split("\n")
      .filter((l) => /^#{1,3} /.test(l))
      .map((l) => slugify(l.replace(/^#+ +/, "")));
    for (const file of ["docs/FAQ.md", "README.md"]) {
      const anchors = [...readFileSync(file, "utf8").matchAll(/\/docs\/performance#([^)\s]+)/g)];
      for (const [, anchor] of anchors) expect(ids).toContain(anchor);
    }
  });

  it("quotes the agent's measured cost, tokens and steps from the committed results", () => {
    const perf = readFileSync("docs/PERFORMANCE.md", "utf8");
    const { calls, costUsd, inputTokens, outputTokens, meanStepsPerRun } = RESULTS;
    expect(perf).toContain(`$${(costUsd / calls).toFixed(4)}`);
    expect(perf).toContain(`${commas(nearest10(inputTokens / calls))} input tokens`);
    expect(perf).toContain(`${nearest10(outputTokens / calls)} output tokens`);
    expect(perf).toContain(`${meanStepsPerRun} steps`);
    expect(perf).toContain(`${calls} runs`);
    // Output per step: total output over total model calls (steps x attempts), rounded to 10.
    const steps = RESULTS.rows.reduce((n, r) => n + r.steps * r.attempts, 0);
    expect(perf).toContain(`${nearest10(outputTokens / steps)} output tokens per step`);
  });

  it("quotes per-run latency as latencyMs divided by attempts", () => {
    const perf = readFileSync("docs/PERFORMANCE.md", "utf8");
    const secs = RESULTS.rows.map((r) => r.latencyMs / r.attempts / 1000);
    expect(perf).toContain(`${Math.min(...secs).toFixed(1)} seconds`);
    expect(perf).toContain(`${Math.max(...secs).toFixed(1)} seconds`);
  });

  it("states the agent limits from config", () => {
    const perf = readFileSync("docs/PERFORMANCE.md", "utf8");
    expect(perf).toContain(`${AGENT.maxSteps} steps`);
    expect(perf).toContain(`${commas(AGENT.maxRunTokens)} tokens`);
    expect(perf).toContain(`${AGENT.maxStepTokens} tokens`);
    expect(perf).toContain(`${AGENT.deadlineMs / 1000} seconds`);
    expect(perf).toContain(`${AGENT.stepMs / 1000} seconds`);
    expect(perf).toContain(`${AGENT.maxSteps + 1} model calls`);
    expect(perf).toContain(`${AGENT_RATE.runProduction} runs a minute`);
    expect(perf).toContain(`${AGENT_RATE.approve} approvals a minute`);
    expect(perf).toContain(`${BUDGET.maxConcurrent} calls at once`);
    expect(perf).toContain(`${AGENT.tokenTtlMs / 60_000} minutes`);
    expect(perf).toContain("## What an agent run costs and how long it takes");
    expect(perf).toContain("### Each limit and what it protects against");
  });
});
