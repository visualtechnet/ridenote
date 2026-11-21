import { runLogLine, toolLogLines, toolTraceLines } from "./log";
import type { StepRecord } from "./types";

const AT = new Date("2026-11-16T12:00:00.000Z");

function record(calls: { name: string; input?: unknown; content?: string; is_error?: boolean }[]) {
  const r: StepRecord = {
    step: 2,
    stopReason: "tool_use",
    calls: calls.map((c) => ({
      name: c.name,
      input: c.input ?? {},
      content: c.content ?? "",
      is_error: c.is_error ?? false,
    })),
    inputTokens: 0,
    outputTokens: 0,
    cacheRead: 0,
    ms: 0,
  };
  return r;
}

describe("toolLogLines", () => {
  it("writes one line per call with the known tool name or unknown, and ok", () => {
    const lines = toolLogLines(
      record([
        { name: "find_rider" },
        { name: "check_vehicle_availability", is_error: true },
        { name: "rm -rf" },
      ]),
      "run-1",
      AT,
    );
    const parsed = lines.map((l) => JSON.parse(l));
    expect(parsed.map((p) => p.tool)).toEqual([
      "find_rider",
      "check_vehicle_availability",
      "unknown",
    ]);
    expect(parsed.map((p) => p.ok)).toEqual([true, false, true]);
  });

  it("maps a 5,000 character tool name to unknown and keeps the line short", () => {
    const [line] = toolLogLines(record([{ name: "x".repeat(5000) }]), "run-1", AT);
    expect(JSON.parse(line).tool).toBe("unknown");
    expect(line.length).toBeLessThan(300);
  });

  it("never writes the input or the result content", () => {
    const lines = toolLogLines(
      record([
        {
          name: "find_rider",
          input: { name: "Maria Santos" },
          content: 'No rider matches "Maria Santos"',
          is_error: true,
        },
      ]),
      "run-1",
      AT,
    );
    const text = lines.join("\n");
    expect(text).not.toContain("Maria");
    expect(text).not.toContain("Santos");
    expect(text).not.toContain("matches");
  });

  it("returns no lines for a record with no calls", () => {
    expect(toolLogLines(record([]), "run-1", AT)).toEqual([]);
  });

  it("writes single-line JSON with exactly the keys event, runId, at, step, tool, ok", () => {
    const lines = toolLogLines(record([{ name: "find_rider" }, { name: "nope" }]), "run-9", AT);
    for (const line of lines) {
      expect(line).not.toContain("\n");
      const parsed = JSON.parse(line);
      expect(Object.keys(parsed).sort()).toEqual(["at", "event", "ok", "runId", "step", "tool"]);
      expect(parsed).toMatchObject({
        event: "agent_tool",
        runId: "run-9",
        at: "2026-11-16T12:00:00.000Z",
        step: 2,
      });
    }
  });
});

describe("toolTraceLines", () => {
  it("writes one [tool] line per call with the same unknown mapping", () => {
    const lines = toolTraceLines(
      record([{ name: "find_rider" }, { name: "evil\nname", is_error: true }]),
      "two Marias",
    );
    expect(lines).toEqual([
      "[tool] two Marias step 2 find_rider ok",
      "[tool] two Marias step 2 unknown error",
    ]);
  });
});

describe("runLogLine", () => {
  const usage = { steps: 3, inputTokens: 900, outputTokens: 60, cacheRead: 400, latencyMs: 2100 };

  it("records how the run ended and what it used, as one JSON line", () => {
    const line = runLogLine(
      { status: "failed", reason: "deadline", usage, steps: [] },
      "run-3",
      AT,
    );
    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toEqual({
      event: "agent_run",
      runId: "run-3",
      at: "2026-11-16T12:00:00.000Z",
      status: "failed",
      reason: "deadline",
      steps: 3,
      inputTokens: 900,
      outputTokens: 60,
      cacheRead: 400,
      latencyMs: 2100,
    });
  });

  it("has no reason when the run did not fail, and never carries a draft, question or trip", () => {
    const end = {
      status: "needs_info" as const,
      question: "Which Maria Lopez?",
      options: [],
      resume: "secret-token",
    };
    const line = runLogLine({ status: "needs_info", end, usage, steps: [] }, "run-4", AT);
    expect(JSON.parse(line).reason).toBeNull();
    expect(line).not.toContain("Maria");
    expect(line).not.toContain("secret-token");
  });
});
