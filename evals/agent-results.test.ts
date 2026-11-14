/** @jest-environment node */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { costUsd } from "./prices";
import {
  agentResultsPath,
  formatTable,
  summariseAgentRun,
  writeAgentResults,
  type AgentRow,
} from "./agent-results";

const row = (over: Partial<AgentRow> = {}): AgentRow => ({
  name: "a case",
  critical: false,
  pass: true,
  flaky: false,
  attempts: 1,
  problems: [],
  ended: "proposed",
  steps: 2,
  tools: ["check_vehicle"],
  checkedVehicle: true,
  inputTokens: 1000,
  outputTokens: 100,
  cacheRead: 0,
  latencyMs: 100,
  ...over,
});

describe("summariseAgentRun", () => {
  it("totals tokens and calls and takes means of steps and latency over the rows", () => {
    const rows = [
      row({ steps: 2, latencyMs: 100 }),
      row({ steps: 4, latencyMs: 300, attempts: 3, pass: false }),
    ];
    const s = summariseAgentRun(rows, "claude-haiku-5-5", "abcdef12", "2026-11-13");
    expect(s).toMatchObject({
      model: "claude-haiku-5-5",
      promptVersion: "abcdef12",
      date: "2026-11-13",
      cases: 2,
      passed: 1,
      calls: 4,
      inputTokens: 2000,
      outputTokens: 200,
      meanStepsPerRun: 3,
      meanLatencyMs: 200,
    });
    expect(s.passRate).toBe(0.5);
  });

  it("gives a number for a priced model and null for an unpriced one, with totals unchanged", () => {
    const rows = [row()];
    const priced = summariseAgentRun(rows, "claude-haiku-5-5", "v", "2026-11-13");
    expect(priced.costUsd).toBeCloseTo(costUsd("claude-haiku-5-5", 1000, 100), 10);
    const unpriced = summariseAgentRun(rows, "some-other-model", "v", "2026-11-13");
    expect(unpriced.costUsd).toBeNull();
    expect(unpriced.inputTokens).toBe(1000);
    expect(unpriced.outputTokens).toBe(100);
    expect(unpriced.meanLatencyMs).toBe(100);
  });

  it("gives an empty run zeros, not NaN", () => {
    const s = summariseAgentRun([], "claude-haiku-5-5", "v", "2026-11-13");
    expect(s.passRate).toBe(0);
    expect(s.meanStepsPerRun).toBe(0);
    expect(s.meanLatencyMs).toBe(0);
  });
});

describe("agentResultsPath and writeAgentResults", () => {
  it("names the file by date and model, with an optional label, under evals/agent-results", () => {
    expect(agentResultsPath("2026-11-13", "claude-haiku-5-5")).toBe(
      "evals/agent-results/2026-11-13-claude-haiku-5-5.json",
    );
    expect(agentResultsPath("2026-11-13", "claude-haiku-5-5", "after")).toBe(
      "evals/agent-results/2026-11-13-claude-haiku-5-5-after.json",
    );
  });

  it("writes pretty JSON that reads back with the same rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "ridenote-agent-results-"));
    const path = join(dir, "run.json");
    const rows = [row({ name: "one" }), row({ name: "two", pass: false, problems: ["x"] })];
    const file = { ...summariseAgentRun(rows, "claude-haiku-5-5", "v", "2026-11-13"), rows };
    writeAgentResults(file, path);
    const text = readFileSync(path, "utf8");
    expect(text.endsWith("}\n")).toBe(true);
    expect(JSON.parse(text)).toEqual(file);
    expect(JSON.parse(text).rows).toEqual(rows);
  });
});

describe("formatTable", () => {
  it("prints unpriced instead of a dollar figure for a model with no price", () => {
    const out = formatTable([row()], "some-other-model");
    expect(out).toContain("unpriced");
    expect(out).not.toContain("$0.00");
  });

  it("prints a dollar figure for a priced model", () => {
    const out = formatTable([row()], "claude-haiku-5-5");
    expect(out).toContain("$");
    expect(out).not.toContain("unpriced");
  });

  it("shows the failing case's name, FAIL, how it ended, and the no vehicle check flag", () => {
    const rows = [
      row({ name: "good case" }),
      row({
        name: "bad case",
        pass: false,
        checkedVehicle: false,
        ended: "failed: timeout",
      }),
    ];
    const lines = formatTable(rows, "claude-haiku-5-5").split("\n");
    const good = lines.find((l) => l.includes("good case"))!;
    const bad = lines.find((l) => l.includes("bad case"))!;
    expect(good).toContain("PASS");
    expect(good).not.toContain("no vehicle check");
    expect(bad).toContain("FAIL");
    expect(bad).toContain("failed: timeout");
    expect(bad).toContain("no vehicle check");
  });
});
