import type Anthropic from "@anthropic-ai/sdk";
import type { Clock } from "../clock";
import type { Trip } from "../trip";

export type Rider = {
  id: string;
  name: string;
  home: string;
  mobility_on_file: Trip["mobility"];
  notes: string;
};

export type FieldSource = "note" | "rider_file";

export type MergedTrip = {
  trip: Trip;
  sources: { pickup: FieldSource; mobility: FieldSource | "none" };
  conflicts: "mobility"[];
};

export type AskOption = { label: string; rider_id: string | null };

export type ToolContext = {
  clock: Clock;
  /** The dispatcher's note, for the date checks. */
  note: string;
  /** The validated trip from the parse step. */
  parsed: Trip;
  riders: readonly Rider[];
  /** Signing key, passed in by the caller. */
  secret: string;
  runId: string;
  /** Makes a draft_id; tests pass a fixed one. */
  newId: () => string;
};

export type RunEnd =
  | { status: "proposed"; draftId: string; draft: string; merged: MergedTrip }
  | { status: "needs_info"; question: string; options: AskOption[]; resume: string };

export type ToolResult = { content: string; is_error?: true; end?: RunEnd };

/** One tool call after it ran (or was refused), ready for the step record and the tool_result. */
export type ExecutedCall = {
  id: string;
  name: string;
  input: unknown;
  content: string;
  is_error: boolean;
  end?: RunEnd;
};

export type ToolDef = {
  name: string;
  description: string;
  strict: true;
  input_schema: Anthropic.Tool["input_schema"];
};

export type ModelReply = {
  content: Anthropic.ContentBlock[];
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null };
};

/** One model step: the conversation so far in, one forced tool call out. */
export type AgentModel = (req: {
  messages: Anthropic.MessageParam[];
  signal: AbortSignal;
}) => Promise<ModelReply>;

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

export type AgentUsage = {
  steps: number;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  latencyMs: number;
};

/**
 * What one model call did: tool names, inputs, results, tokens and times. The model's free text is not
 * kept, but a tool input is written by the model and can echo part of the note (a name, a reason), and
 * results hold fixture rider data and the signed draft. Scrub (lib/scrub.ts) before any save.
 */
export type StepRecord = {
  step: number;
  stopReason: string | null;
  calls: { name: string; input: unknown; content: string; is_error: boolean }[];
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  ms: number;
};

export type RunResult = { usage: AgentUsage; steps: StepRecord[] } & (
  | { status: "proposed"; end: Extract<RunEnd, { status: "proposed" }> }
  | { status: "needs_info"; end: Extract<RunEnd, { status: "needs_info" }> }
  | { status: "failed"; reason: FailReason }
);
