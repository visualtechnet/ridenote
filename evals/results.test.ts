/** @jest-environment node */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRICES, PRICES_AS_OF, costUsd } from "./prices";
import { resultsPath, summariseRun, writeResults, type CaseRow } from "./results";

const row = (over: Partial<CaseRow> = {}): CaseRow => ({
  name: "a case",
  critical: false,
  tags: [],
  pass: true,
  flaky: false,
  attempts: 1,
  problems: [],
  answer: null,
  inputTokens: 1000,
  outputTokens: 100,
  latencyMs: 100,
  ...over,
});

describe("prices", () => {
  it("prices the two models and charges nothing for an unknown one", () => {
    expect(costUsd("claude-haiku-5-5", 1_000_000, 1_000_000)).toBeCloseTo(0.6, 6);
    expect(costUsd("claude-sonnet-5-5", 1_000_000, 0)).toBeCloseTo(2, 6);
    expect(costUsd("other", 1, 1)).toBe(0);
  });

  it("names the day the prices were taken, and lists both models", () => {
    expect(PRICES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Object.keys(PRICES).sort()).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5"]);
  });
});

describe("summariseRun", () => {
  it("summarises pass rate, critical failures, tokens, cost and latency", () => {
    const rows = [
      row({ name: "one", latencyMs: 100 }),
      row({ name: "two", latencyMs: 200 }),
      row({ name: "three", critical: true, pass: false, problems: ["x"], latencyMs: 900 }),
    ];
    const s = summariseRun(rows, "claude-haiku-5-5", "abcdef12", "2026-11-02");
    expect(s).toMatchObject({
      model: "claude-haiku-5-5",
      promptVersion: "abcdef12",
      date: "2026-11-02",
      cases: 3,
      passed: 2,
      criticalFailed: 1,
      inputTokens: 3000,
      outputTokens: 300,
      medianLatencyMs: 200,
      meanLatencyMs: 400,
    });
    expect(s.passRate).toBeCloseTo(2 / 3, 6);
    expect(s.calls).toBe(3);
    expect(s.meanLatencyPerCallMs).toBe(400);
    expect(s.costUsd).toBeCloseTo(costUsd("claude-haiku-5-5", 3000, 300), 10);
    expect(s.costPerCaseUsd).toBeCloseTo(s.costUsd / 3, 10);
  });

  it("takes the median as the mean of the two middle latencies when the count is even", () => {
    const rows = [100, 300, 200, 1000].map((latencyMs) => row({ latencyMs }));
    expect(summariseRun(rows, "claude-haiku-5-5", "v", "2026-11-02").medianLatencyMs).toBe(250);
  });

  it("counts latency per call as well as per case, since a critical case makes three calls", () => {
    const rows = [row({ critical: true, attempts: 3, latencyMs: 900 }), row({ latencyMs: 100 })];
    const s = summariseRun(rows, "claude-haiku-5-5", "v", "2026-11-02");
    expect(s.calls).toBe(4);
    expect(s.meanLatencyPerCallMs).toBe(250);
    expect(s.meanLatencyMs).toBe(500);
  });

  it("gives an empty run a pass rate of zero, not NaN", () => {
    const s = summariseRun([], "claude-haiku-5-5", "v", "2026-11-02");
    expect(s.passRate).toBe(0);
    expect(s.medianLatencyMs).toBe(0);
    expect(s.costPerCaseUsd).toBe(0);
  });
});

describe("resultsPath and writeResults", () => {
  it("names the file by date and model, with an optional label", () => {
    expect(resultsPath("2026-11-02", "claude-haiku-5-5")).toBe(
      "evals/results/2026-11-02-claude-haiku-5-5.json",
    );
    expect(resultsPath("2026-11-02", "claude-haiku-5-5", "after-shorthand")).toBe(
      "evals/results/2026-11-02-claude-haiku-5-5-after-shorthand.json",
    );
  });

  it("writes pretty JSON with a trailing newline", () => {
    const dir = mkdtempSync(join(tmpdir(), "ridenote-results-"));
    const path = join(dir, "run.json");
    const rows = [row()];
    const file = { ...summariseRun(rows, "claude-haiku-5-5", "v", "2026-11-02"), rows };
    writeResults(file, path);
    const text = readFileSync(path, "utf8");
    expect(text.endsWith("}\n")).toBe(true);
    expect(text).toContain('\n  "rows": [');
    expect(JSON.parse(text)).toEqual(file);
  });
});
