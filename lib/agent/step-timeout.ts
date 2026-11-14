import type { AgentModel, ModelReply } from "./types";

type Options = { stepMs: number; retries: number };

/** A model call that ran past its own time limit. The loop reads it as an upstream failure. */
export class StepTimeoutError extends Error {
  override name = "StepTimeoutError";
}

/** A server error, rate limit or lost connection: the kind a second try can fix. A 400 is not. */
function retryable(err: unknown): boolean {
  if (err instanceof StepTimeoutError) return true;
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === "number") return status === 429 || status >= 500;
  return (err as { name?: unknown } | null)?.name === "APIConnectionError";
}

/**
 * Gives each model call its own time limit (AGENT.stepMs) and retries a timeout or a server error
 * a set number of times. The run's own signal still ends everything at once: the run deadline is
 * shared, not reset, by a retry.
 */
export function withStepTimeout(model: AgentModel, { stepMs, retries }: Options): AgentModel {
  return async ({ messages, signal }): Promise<ModelReply> => {
    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      const onRunAbort = () => controller.abort();
      signal.addEventListener("abort", onRunAbort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, stepMs);
      try {
        return await model({ messages, signal: controller.signal });
      } catch (err) {
        // The run itself was stopped (deadline, abort): the loop decides what that means.
        if (signal.aborted) throw err;
        const failure = timedOut ? new StepTimeoutError("model call timed out") : err;
        if (attempt >= retries || !retryable(failure)) throw failure;
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", onRunAbort);
      }
    }
  };
}
