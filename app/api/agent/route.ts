import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { resolveTimeZone, type Clock } from "@/lib/clock";
import { AGENT, AGENT_RATE, BUDGET, HTTP, LIMITS, RATE_LIMIT } from "@/lib/config";
import { clientKey, UNKNOWN_CLIENT } from "@/lib/client-key";
import { guardRoute } from "@/lib/api-guard";
import { createGate } from "@/lib/concurrency";
import { createStubClient, stubActive } from "@/lib/e2e-stub-client";
import { extractTrip } from "@/lib/extract";
import { readBodyText } from "@/lib/read-body";
import { MESSAGES } from "@/lib/messages";
import { createRateLimiter } from "@/lib/rate-limit";
import { upstreamBudget } from "@/lib/upstream-budget";
import { validateRequestBody } from "@/lib/validation";
import { checkResumeChoice } from "@/lib/agent/ask-dispatcher";
import { fakeAgentModel } from "@/lib/agent/fake-agent";
import { createAnthropicModel, agentModelName } from "@/lib/agent/model";
import { agentSystemPrompt } from "@/lib/agent/prompt";
import { signingSecret } from "@/lib/agent/secret";
import { runNote, runResume, type ServiceDeps } from "@/lib/agent/service";
import { encodeLine, type StreamEvent } from "@/lib/agent/stream";
import type { AgentModel, Rider } from "@/lib/agent/types";
import { RIDERS } from "@/lib/agent/riders";

const production = process.env.VERCEL_ENV === "production";
const checkRunByClient = createRateLimiter({
  limit: production ? AGENT_RATE.runProduction : AGENT_RATE.runOther,
  windowMs: AGENT_RATE.windowMs,
});
const checkRunUnknownClient = createRateLimiter({
  limit: RATE_LIMIT.maxRequests,
  windowMs: AGENT_RATE.windowMs,
  maxKeys: 1,
});
// Runs in flight in this instance; a run holds its slot until its stream ends. Kept apart from the
// parse route's gate so a slow agent run can never slow a parse (AL-6).
const gate = createGate(BUDGET.maxConcurrent);

/**
 * The most model calls one run can make: every step, each with its one retry, plus the parse step.
 * A run takes this up front and gives back whatever it did not use (see the refund in POST).
 */
const WORST_CASE_CALLS = AGENT.maxSteps * (AGENT.stepRetries + 1) + 1;

/** A run can take up to a minute: give the platform room for it. */
export const maxDuration = 60;

const ResumeBody = z.strictObject({
  timeZone: z.unknown().optional(),
  resume: z.strictObject({
    token: z.string().min(1).max(4000),
    choice: z
      .number()
      .int()
      .min(0)
      .max(AGENT.maxOptions - 1),
  }),
});

const json = (body: unknown, status: number, headers?: Record<string, string>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

const UNAVAILABLE = "Agent unavailable";
const BUSY = "The agent is busy. Try again in a moment.";

let client: Pick<Anthropic, "messages"> | undefined;
/** The real client is made once; the browser-test stand-in is cheap and is made per use. */
function getClient(): Pick<Anthropic, "messages"> {
  if (stubActive()) return createStubClient();
  client ??= new Anthropic();
  return client;
}

/** The model and parse step for this request: real in production, the browser-test stand-ins under the stub. */
function models(clock: Clock): { parse: ServiceDeps["parse"]; model: AgentModel } | null {
  if (stubActive()) {
    return {
      parse: (note, c, signal) => extractTrip(getClient(), note, { clock: c, signal }),
      model: fakeAgentModel(),
    };
  }
  try {
    const model = createAnthropicModel(getClient(), {
      model: agentModelName(process.env),
      system: agentSystemPrompt(clock),
    });
    return {
      parse: (note, c, signal) => extractTrip(getClient(), note, { clock: c, signal }),
      model,
    };
  } catch {
    return null;
  }
}

async function handle(req: Request) {
  const key = clientKey(req);
  const rate = key === UNKNOWN_CLIENT ? checkRunUnknownClient(key) : checkRunByClient(key);
  if (!rate.allowed) {
    return json({ error: "Too many requests. Try again shortly." }, HTTP.tooManyRequests, {
      "Retry-After": String(rate.retryAfterSec),
    });
  }
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Send JSON." }, HTTP.unsupportedMediaType);
  }
  if (Number(req.headers.get("content-length")) > LIMITS.bodyMaxBytes) {
    return json({ error: "The note is too long." }, HTTP.payloadTooLarge);
  }
  const read = await readBodyText(req, LIMITS.bodyMaxBytes);
  if (!read.ok) {
    return read.reason === "too_large"
      ? json({ error: "The note is too long." }, HTTP.payloadTooLarge)
      : json({ error: MESSAGES.unreadable, code: "unreadable" }, HTTP.badRequest);
  }

  let body: unknown;
  try {
    body = JSON.parse(read.text);
  } catch {
    return json({ error: "The request is not valid JSON." }, HTTP.badRequest);
  }

  const secret = signingSecret(process.env);
  if (!secret.ok) return json({ error: UNAVAILABLE, code: "unavailable" }, HTTP.unavailable);

  const isResume = typeof body === "object" && body !== null && "resume" in body;
  let clock: Clock;
  let note = "";
  let resume: { token: string; choice: number } | undefined;
  if (isResume) {
    const parsed = ResumeBody.safeParse(body);
    if (!parsed.success)
      return json({ error: "The choice is not valid.", code: "invalid" }, HTTP.badRequest);
    clock = { now: new Date(), timeZone: resolveTimeZone(parsed.data.timeZone) };
    resume = parsed.data.resume;
  } else {
    const input = validateRequestBody(body);
    if (!input.ok) return json({ error: input.message, code: input.code }, HTTP.badRequest);
    clock = { now: new Date(), timeZone: input.timeZone };
    note = input.note;
  }

  // Checked before any model call: a forged, expired or unoffered choice costs nothing.
  let resumed: ReturnType<typeof checkResumeChoice> | undefined;
  if (resume) {
    resumed = checkResumeChoice(resume.token, resume.choice, secret.secret, clock.now);
    if (!resumed.ok)
      return json(
        { error: "That answer has expired or is not valid.", code: resumed.reason },
        HTTP.badRequest,
      );
  }

  const wiring = models(clock);
  if (!wiring) return json({ error: UNAVAILABLE, code: "unavailable" }, HTTP.unavailable);

  const release = gate.tryAcquire();
  if (!release) return json({ error: BUSY }, HTTP.unavailable, { "Retry-After": "1" });
  // A run asks for its worst case before the first model call; the unused part is refunded at the end.
  const grant = upstreamBudget.reserve(WORST_CASE_CALLS);
  if (!grant) {
    release();
    return json({ error: BUSY }, HTTP.unavailable, {
      "Retry-After": String(upstreamBudget.retryAfterSec()),
    });
  }

  // Counts the calls this run actually starts, so the unused units can be given back.
  let spent = 0;
  const countedModel: AgentModel = (modelReq) => {
    spent += 1;
    return wiring.model(modelReq);
  };
  const countedParse: ServiceDeps["parse"] = (n, c, signal) => {
    spent += 1;
    return wiring.parse(n, c, signal);
  };

  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const riders: readonly Rider[] = RIDERS;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(encodeLine(event)));
        } catch {
          // The client has gone: nobody is listening, so the run just finishes quietly.
        }
      };
      const deps: ServiceDeps = {
        parse: countedParse,
        model: countedModel,
        secret: secret.secret,
        riders,
        newId: () => crypto.randomUUID(),
        newRunId: () => crypto.randomUUID(),
        signal: abort.signal,
        emit,
      };
      const run = resumed?.ok
        ? runResume(deps, resumed.payload, resumed.option, clock)
        : runNote(deps, note, clock);
      run
        .catch(() => emit({ type: "error", code: "unavailable" }))
        .finally(() => {
          upstreamBudget.refund(WORST_CASE_CALLS - spent, grant);
          release();
          try {
            controller.close();
          } catch {
            // Already closed by a cancel.
          }
        });
    },
    cancel() {
      abort.abort();
      // The run's own finally also releases; the gate ignores a second release.
      release();
    },
  });

  return new Response(stream, {
    status: HTTP.ok,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const POST = guardRoute("agent", handle);
