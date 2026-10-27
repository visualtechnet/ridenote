import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { BUDGET, HTTP, LIMITS, RATE_LIMIT, UPSTREAM } from "@/lib/config";
import { createCoalescer } from "@/lib/coalesce";
import { createGate } from "@/lib/concurrency";
import { MESSAGES } from "@/lib/messages";
import { SYSTEM, wrapNote } from "@/lib/prompt";
import { createRateLimiter } from "@/lib/rate-limit";
import { readLimitedText } from "@/lib/read-body";
import { TripSchema, missingFields } from "@/lib/trip";
import { validateRequestBody } from "@/lib/validation";

// Layer 1: per client, counts every request (valid or not).
const checkRate = createRateLimiter({
  limit: RATE_LIMIT.maxRequests,
  windowMs: RATE_LIMIT.windowMs,
});
// Layer 2: everyone together, counts only requests that reach the paid upstream call.
const checkBudget = createRateLimiter({
  limit: BUDGET.maxCallsPerWindow,
  windowMs: BUDGET.windowMs,
  maxKeys: 1,
});
// Layer 3: how many upstream calls may run at once in this instance.
const gate = createGate(BUDGET.maxConcurrent);
// Identical notes submitted at the same moment share one upstream call.
const coalescer = createCoalescer<Outcome>();

let client: Anthropic | undefined;

/** Upstream timeout plus one retry can take about a minute; give the platform room for it. */
export const maxDuration = 90;

type Outcome = { status: number; body: unknown; retryAfterSec?: number; failure?: string };

function json(body: unknown, status: number = HTTP.ok, headers?: Record<string, string>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

// Known limit: with no proxy headers at all (local dev, bare `next start`) everyone shares the
// "unknown" bucket. Hosts like Vercel always set x-real-ip, so deploy behind one.
// Never key on the first x-forwarded-for entry: the client writes it. x-real-ip is set by the
// hosting platform (e.g. Vercel); otherwise take the last hop, which our own proxy appended.
function clientKey(req: Request) {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
}

/** The one paid call. Never throws: failures come back as an Outcome so they can be shared. */
async function callModel(note: string, signal: AbortSignal): Promise<Outcome> {
  // Concurrency first, so a request turned away at the gate does not spend the shared budget.
  const release = gate.tryAcquire();
  if (!release)
    return { status: HTTP.unavailable, body: { error: MESSAGES.busy }, retryAfterSec: 1 };
  const budget = checkBudget("all");
  if (!budget.allowed) {
    release();
    return {
      status: HTTP.unavailable,
      body: { error: MESSAGES.busy },
      retryAfterSec: budget.retryAfterSec,
    };
  }

  try {
    client ??= new Anthropic();
    const res = await client.messages.parse(
      {
        model: process.env[UPSTREAM.modelEnvVar] ?? UPSTREAM.defaultModel,
        max_tokens: UPSTREAM.maxTokens,
        system: SYSTEM,
        messages: [{ role: "user", content: wrapNote(note) }],
        output_config: { format: zodOutputFormat(TripSchema) },
      },
      // Don't let a hung upstream hold the request open, and stop paying if every caller leaves.
      { timeout: UPSTREAM.timeoutMs, maxRetries: UPSTREAM.maxRetries, signal },
    );

    if (res.stop_reason === "refusal") {
      return { status: HTTP.unprocessable, body: { error: MESSAGES.modelDeclined } };
    }
    if (res.stop_reason !== "end_turn") {
      return { status: HTTP.badGateway, body: { error: MESSAGES.parseFailed } };
    }

    // Model output is untrusted: re-validate before it reaches the client.
    const trip = TripSchema.safeParse(res.parsed_output);
    if (!trip.success) return { status: HTTP.badGateway, body: { error: MESSAGES.parseFailed } };

    return {
      status: HTTP.ok,
      body: { trip: { ...trip.data, missing_fields: missingFields(trip.data) } },
    };
  } catch (err) {
    return {
      status: HTTP.badGateway,
      body: { error: MESSAGES.parseFailed },
      failure: err instanceof Error ? err.name : "unknown error",
    };
  } finally {
    release();
  }
}

export async function POST(req: Request) {
  const rate = checkRate(clientKey(req));
  if (!rate.allowed) {
    return json({ error: MESSAGES.tooManyRequests }, HTTP.tooManyRequests, {
      "Retry-After": String(rate.retryAfterSec),
    });
  }

  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: MESSAGES.unsupportedMediaType }, HTTP.unsupportedMediaType);
  }

  const tooLarge = () => json({ error: MESSAGES.bodyTooLarge }, HTTP.payloadTooLarge);
  if (Number(req.headers.get("content-length")) > LIMITS.bodyMaxBytes) return tooLarge();
  const raw = await readLimitedText(req, LIMITS.bodyMaxBytes);
  if (raw === null) return tooLarge();

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: MESSAGES.invalidJson }, HTTP.badRequest);
  }

  const input = validateRequestBody(body);
  if (!input.ok) return json({ error: input.message, code: input.code }, HTTP.badRequest);

  const outcome = await coalescer.run(
    input.note,
    (signal) => callModel(input.note, signal),
    req.signal,
  );

  // The client left (closed the tab, cancelled): nobody is listening, and it is not a failure.
  if (req.signal.aborted) return new Response(null, { status: HTTP.clientClosed });
  // Log the error type only: SDK messages can echo request details, and notes contain passenger PII.
  if (outcome.failure) console.error("parse failed:", outcome.failure);
  return json(
    outcome.body,
    outcome.status,
    outcome.retryAfterSec ? { "Retry-After": String(outcome.retryAfterSec) } : undefined,
  );
}
