import { z } from "zod";
import { AGENT_RATE, HTTP, LIMITS, RATE_LIMIT } from "@/lib/config";
import { clientKey, UNKNOWN_CLIENT } from "@/lib/client-key";
import { saveDraft } from "@/lib/history";
import { readLimitedText } from "@/lib/read-body";
import { createRateLimiter } from "@/lib/rate-limit";
import { type DraftPayload } from "@/lib/agent/propose-trip";
import { signingSecret } from "@/lib/agent/secret";
import { verify } from "@/lib/agent/sign";
import { TripSchema } from "@/lib/trip";

const checkApproveByClient = createRateLimiter({
  limit: AGENT_RATE.approve,
  windowMs: AGENT_RATE.windowMs,
});
const checkApproveUnknownClient = createRateLimiter({
  limit: RATE_LIMIT.maxRequests,
  windowMs: AGENT_RATE.windowMs,
  maxKeys: 1,
});

const ApproveBody = z.strictObject({ draft: z.string().min(1).max(8000) });

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Approve: the only write an agent run leads to, and it is started by a person. It checks the signed
 * draft (signature, expiry, schema) and saves the trip once. It never calls the model.
 */
export async function POST(req: Request) {
  const key = clientKey(req);
  const rate = key === UNKNOWN_CLIENT ? checkApproveUnknownClient(key) : checkApproveByClient(key);
  if (!rate.allowed) {
    return json({ error: "Too many requests. Try again shortly." }, HTTP.tooManyRequests);
  }
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Send JSON." }, HTTP.unsupportedMediaType);
  }
  if (Number(req.headers.get("content-length")) > LIMITS.bodyMaxBytes) {
    return json({ error: "The draft is too large." }, HTTP.payloadTooLarge);
  }
  const raw = await readLimitedText(req, LIMITS.bodyMaxBytes);
  if (raw === null) return json({ error: "The draft is too large." }, HTTP.payloadTooLarge);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "The request is not valid JSON." }, HTTP.badRequest);
  }
  const input = ApproveBody.safeParse(body);
  if (!input.success)
    return json({ error: "The draft is missing.", code: "invalid" }, HTTP.badRequest);

  const secret = signingSecret(process.env);
  if (!secret.ok)
    return json({ error: "Agent unavailable", code: "unavailable" }, HTTP.unavailable);

  const verified = verify<DraftPayload>(input.data.draft, secret.secret, new Date(), "draft");
  if (!verified.ok) {
    return json(
      { error: "That draft has expired or is not valid.", code: verified.reason },
      HTTP.badRequest,
    );
  }
  const payload = verified.payload;
  const trip = TripSchema.safeParse(payload.trip);
  if (payload.v !== 1 || !trip.success) {
    return json({ error: "That draft is not a valid trip.", code: "invalid" }, HTTP.badRequest);
  }

  try {
    const outcome = await saveDraft(trip.data, payload.draft_id);
    if (outcome === "off") {
      return json(
        { status: "history_off", message: "History is off here, so nothing was saved." },
        HTTP.ok,
      );
    }
    if (outcome === "nothing") {
      return json(
        { status: "nothing_to_save", message: "There was nothing worth saving." },
        HTTP.ok,
      );
    }
    if (outcome === "capped") {
      return json({ status: "capped", error: "Today's save limit is reached." }, HTTP.unavailable);
    }
    return json(
      { status: outcome, message: outcome === "saved" ? "Saved to History." : "Already saved." },
      HTTP.ok,
    );
  } catch (err) {
    console.error("approve failed:", err instanceof Error ? err.name : "unknown");
    return json({ error: "Could not save. Try again." }, HTTP.unavailable);
  }
}
