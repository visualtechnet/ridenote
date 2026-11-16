import type { Trip } from "./trip";

/**
 * The agent's wire format: what the page receives, one JSON object per line. It lives outside
 * lib/agent so browser code can use these types without importing the agent (see
 * tests/agent-boundary.test.ts). The server builds these events in lib/agent/stream.ts.
 */
export type FieldSource = "note" | "rider_file";

export type AskOption = { label: string; rider_id: string | null };

export type MergedTrip = {
  trip: Trip;
  sources: { pickup: FieldSource; mobility: FieldSource | "none" };
  conflicts: "mobility"[];
};

export type AgentUsage = {
  steps: number;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  latencyMs: number;
};

export type FailReason =
  | "step_cap"
  | "token_budget"
  | "deadline"
  | "upstream"
  | "refused"
  | "cut_off"
  | "invalid_tool_input"
  | "no_tool_call"
  | "aborted";

/**
 * A step carries tool names, results and numbers. It never carries a tool input (a model-written
 * string that can echo the note) or model free text.
 */
export type StreamEvent =
  | { type: "run_started"; runId: string }
  | { type: "parsed"; trip: Trip }
  | {
      type: "step";
      step: number;
      stopReason: string | null;
      calls: { name: string; is_error: boolean; content: string }[];
      inputTokens: number;
      outputTokens: number;
      ms: number;
    }
  | { type: "error"; code: "parse_failed" | "busy" | "unavailable" }
  | {
      type: "ended";
      status: "proposed";
      draftId: string;
      draft: string;
      merged: MergedTrip;
      usage: AgentUsage;
    }
  | {
      type: "ended";
      status: "needs_info";
      question: string;
      options: AskOption[];
      resume: string;
      usage: AgentUsage;
    }
  | { type: "ended"; status: "failed"; reason: FailReason; usage: AgentUsage };
