import { TOOL_DEFS } from "./tools";
import type { StepRecord } from "./types";

const KNOWN_TOOLS: ReadonlySet<string> = new Set(TOOL_DEFS.map((def) => def.name));

/**
 * The tool name that is safe to write. The model chooses the name, so only one of our own tools is
 * written as is; anything else (another string, a non-string, a very long text) becomes "unknown".
 */
function safeToolName(name: unknown): string {
  return typeof name === "string" && KNOWN_TOOLS.has(name) ? name : "unknown";
}

/**
 * One single-line JSON string per tool call of a step, for the server log. It holds the event name,
 * run id, time, step number, a known tool name and whether the call worked. Never the input or the
 * result: both can carry a rider name from the note.
 */
export function toolLogLines(record: StepRecord, runId: string, at: Date): string[] {
  return record.calls.map((call) =>
    JSON.stringify({
      event: "agent_tool",
      runId,
      at: at.toISOString(),
      step: record.step,
      tool: safeToolName(call.name),
      ok: !call.is_error,
    }),
  );
}

/** One `[tool]` line per call for the eval script's output, with the same fields and the same mapping. */
export function toolTraceLines(record: StepRecord, label: string): string[] {
  return record.calls.map(
    (call) =>
      `[tool] ${label} step ${record.step} ${safeToolName(call.name)} ${call.is_error ? "error" : "ok"}`,
  );
}
