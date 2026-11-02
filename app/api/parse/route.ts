import Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import type { Clock } from "@/lib/clock";
import { BUDGET, HTTP, LIMITS, RATE_LIMIT } from "@/lib/config";
import { createCoalescer } from "@/lib/coalesce";
import { createGate } from "@/lib/concurrency";
import { createStubClient, stubActive } from "@/lib/e2e-stub-client";
import { extractTrip } from "@/lib/extract";
import { saveEntry } from "@/lib/history";
import { MESSAGES } from "@/lib/messages";
import { PROMPT_VERSION } from "@/lib/prompt";
import { createRateLimiter, maxRequestsFor } from "@/lib/rate-limit";
import { isOutOfCredit } from "@/lib/upstream-errors";
import { readLimitedText } from "@/lib/read-body";
import type { Trip } from "@/lib/trip";
import { toUsage, type Usage } from "@/lib/usage";
import { validateRequestBody } from "@/lib/validation";

// Layer 1: per client, counts every request (valid or not).
const checkRateByClient = createRateLimiter({
  limit: maxRequestsFor(process.env),
  windowMs: RATE_LIMIT.windowMs,
});
// Requests with no usable client IP all share one key. A strict per-client limit would lock the
// whole site out, so that shared bucket always gets the looser limit, even in production.
const checkRateUnknownClient = createRateLimiter({
  limit: RATE_LIMIT.maxRequests,
  windowMs: RATE_LIMIT.windowMs,
  maxKeys: 1,
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

let client: Pick<Anthropic, "messages"> | undefined;

/** Upstream timeout plus one retry is about 24 s (UPSTREAM in lib/config.ts); give the platform room for it. */
export const maxDuration = 60;

type Outcome = { status: number; body: unknown; retryAfterSec?: number; failure?: string };

function json(body: unknown, status: number = HTTP.ok, headers?: Record<string, string>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

// Known limit: with no proxy headers at all (local dev, bare `next start`) everyone shares the
// "unknown" bucket. Hosts like Vercel always set x-real-ip, so deploy behind one.
// Never key on the first x-forwarded-for entry: the client writes it. x-real-ip is set by the
// hosting platform (e.g. Vercel); otherwise take the last hop, which our own proxy appended.
const UNKNOWN_CLIENT = "unknown";
function clientKey(req: Request) {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || UNKNOWN_CLIENT;
}

function checkRate(key: string) {
  return key === UNKNOWN_CLIENT ? checkRateUnknownClient(key) : checkRateByClient(key);
}

/**
 * Saves the parsed trip to History once the response is sent. Only the trip goes in, never the
 * note. Nothing here may change the response: `after` can throw (no request scope) and the save
 * itself never throws, but both are guarded so a broken History cannot break a parse.
 */
function saveAfterResponse(trip: Trip, usage: Usage) {
  try {
    after(async () => {
      try {
        await saveEntry(trip, usage);
      } catch {
        // Already logged by saveEntry (error name only); never rethrow.
      }
    });
  } catch {
    // History is a side effect; the parse result stands.
  }
}

/** The one paid call. Never throws: failures come back as an Outcome so they can be shared. */
async function callModel(note: string, clock: Clock, signal: AbortSignal): Promise<Outcome> {
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
    client ??= stubActive() ? createStubClient() : new Anthropic();
    const requestId = crypto.randomUUID();
    const result = await extractTrip(client, note, { clock, signal });
    // One line per paid call: an id and time to find it by, the prompt it ran with, and numbers,
    // model name and stop reason. Never the note or anything parsed from it.
    console.info(
      "parse usage:",
      JSON.stringify({
        event: "llm_call",
        requestId,
        at: new Date().toISOString(),
        promptVersion: PROMPT_VERSION,
        ...result.meta,
      }),
    );
    if (!result.ok) return { status: result.status, body: { error: result.error } };
    const usage = toUsage(result.meta);
    saveAfterResponse(result.trip, usage);
    return { status: HTTP.ok, body: { trip: result.trip, usage } };
  } catch (err) {
    // The one failure a person can act on. It is logged as its own kind so the owner sees it.
    if (isOutOfCredit(err)) {
      return {
        status: HTTP.unavailable,
        body: { error: MESSAGES.outOfCredit, code: "out_of_credit" },
        failure: "out of credit",
      };
    }
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

  // The only place the system clock is read. "Today" is this moment in the dispatcher's zone.
  const clock: Clock = { now: new Date(), timeZone: input.timeZone };
  // Two identical notes from different zones can resolve "tomorrow" differently, so the zone is
  // part of what makes a request "the same".
  const outcome = await coalescer.run(
    JSON.stringify([input.timeZone, input.note]),
    (signal) => callModel(input.note, clock, signal),
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
