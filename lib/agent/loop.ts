import type Anthropic from "@anthropic-ai/sdk";
import { AGENT } from "../config";
import { wrapNote } from "../prompt";
import { executeToolCalls } from "./execute";
import type {
  AgentModel,
  ExecutedCall,
  FailReason,
  RunResult,
  StepRecord,
  ToolContext,
} from "./types";

const REPROMPT = "You did not call a tool. Call one of the tools now to continue.";

type Options = {
  model: AgentModel;
  ctx: ToolContext;
  signal?: AbortSignal;
  onStep?: (record: StepRecord) => void;
  /** A monotonic millisecond clock. */
  now?: () => number;
  /**
   * Rider ids already known to be real without a find_rider call in this run: the signed resume
   * token carries the one the dispatcher chose, and the server issued it from a real search.
   */
  knownRiderIds?: readonly string[];
};

/**
 * Runs the model and the tools until a result ends the run or a named limit stops it. A run ends
 * only through a result with `end` or a failure; tools never run from a cut-off or refused reply.
 */
export async function runAgent(options: Options): Promise<RunResult> {
  const { model, ctx, onStep, now = () => performance.now() } = options;
  const signal = options.signal ?? new AbortController().signal;
  const start = now();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: wrapNote(ctx.note) }];
  const steps: StepRecord[] = [];
  const seenRiderIds = new Set<string>(options.knownRiderIds ?? []);
  const usage = { steps: 0, inputTokens: 0, outputTokens: 0, cacheRead: 0, latencyMs: 0 };
  let errorSteps = 0;
  let reprompted = false;

  const fail = (reason: FailReason): RunResult => {
    usage.latencyMs = now() - start;
    return { status: "failed", reason, usage: { ...usage }, steps };
  };

  for (;;) {
    if (signal.aborted) return fail("aborted");
    if (now() - start >= AGENT.deadlineMs) return fail("deadline");
    if (usage.steps >= AGENT.maxSteps) return fail("step_cap");
    if (usage.inputTokens + usage.outputTokens >= AGENT.maxRunTokens) return fail("token_budget");

    usage.steps += 1;
    const stepStart = now();
    const remaining = AGENT.deadlineMs - (now() - start);
    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    signal.addEventListener("abort", onCallerAbort, { once: true });
    let deadlineHit = false;
    // Not AbortSignal.timeout/any: they ignore Jest fake timers.
    const timer = setTimeout(() => {
      deadlineHit = true;
      controller.abort();
    }, remaining);
    let reply;
    try {
      reply = await model({ messages: [...messages], signal: controller.signal });
    } catch (e) {
      if (signal.aborted) return fail("aborted");
      if (deadlineHit) return fail("deadline");
      return fail(e instanceof Error && e.name === "AbortError" ? "aborted" : "upstream");
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onCallerAbort);
    }
    const inputTokens = reply.usage.input_tokens;
    const outputTokens = reply.usage.output_tokens;
    const cacheRead = reply.usage.cache_read_input_tokens ?? 0;
    usage.inputTokens += inputTokens;
    usage.outputTokens += outputTokens;
    usage.cacheRead += cacheRead;

    const toolBlocks = reply.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const runnable = reply.stop_reason === "tool_use" && toolBlocks.length > 0;
    const executed: ExecutedCall[] = runnable
      ? executeToolCalls(toolBlocks, ctx, seenRiderIds)
      : [];

    const record: StepRecord = {
      step: usage.steps,
      stopReason: reply.stop_reason,
      calls: executed.map(({ name, input, content, is_error }) => ({
        name,
        input,
        content,
        is_error,
      })),
      inputTokens,
      outputTokens,
      cacheRead,
      ms: now() - stepStart,
    };
    steps.push(record);
    try {
      onStep?.(record);
    } catch {
      // A failing observer must not change the run.
    }

    if (reply.stop_reason === "max_tokens") return fail("cut_off");
    if (reply.stop_reason === "refusal") return fail("refused");

    if (!runnable) {
      if (reply.stop_reason !== "end_turn" && reply.stop_reason !== "tool_use") {
        return fail("upstream");
      }
      if (reprompted) return fail("no_tool_call");
      reprompted = true;
      const kept = reply.content.filter((b) => b.type !== "tool_use");
      messages.push({
        role: "assistant",
        content: kept.length > 0 ? kept : [{ type: "text", text: "(no tool call)" }],
      });
      messages.push({ role: "user", content: REPROMPT });
      continue;
    }

    const ended = executed.find((c) => c.end !== undefined);
    if (ended?.end !== undefined) {
      usage.latencyMs = now() - start;
      const base = { usage: { ...usage }, steps };
      return ended.end.status === "proposed"
        ? { ...base, status: "proposed", end: ended.end }
        : { ...base, status: "needs_info", end: ended.end };
    }

    // A search that finds nobody is information, not a mistake: it neither counts nor builds up.
    errorSteps = executed.every((c) => c.is_error && !c.expected) ? errorSteps + 1 : 0;
    if (errorSteps >= AGENT.maxToolErrors) return fail("invalid_tool_input");

    messages.push({ role: "assistant", content: reply.content });
    messages.push({
      role: "user",
      content: executed.map((c) => ({
        type: "tool_result",
        tool_use_id: c.id,
        content: c.content,
        ...(c.is_error ? { is_error: true } : {}),
      })),
    });
  }
}
