import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { HTTP, UPSTREAM } from "./config";
import { MESSAGES } from "./messages";
import { SYSTEM, wrapNote } from "./prompt";
import { ModelTripSchema, TripSchema, missingFields, normalizeModelTrip, type Trip } from "./trip";

export type Extraction = { ok: true; trip: Trip } | { ok: false; status: number; error: string };

/**
 * The one model call, shared by the API route and the eval suite so both test the same prompt,
 * schema and validation. Throws if the SDK itself fails (network, timeout, abort).
 */
export async function extractTrip(
  client: Pick<Anthropic, "messages">,
  note: string,
  options: { signal?: AbortSignal } = {},
): Promise<Extraction> {
  const res = await client.messages.parse(
    {
      model: process.env[UPSTREAM.modelEnvVar] ?? UPSTREAM.defaultModel,
      max_tokens: UPSTREAM.maxTokens,
      system: SYSTEM,
      messages: [{ role: "user", content: wrapNote(note) }],
      output_config: { format: zodOutputFormat(ModelTripSchema) },
    },
    // Don't let a hung upstream hold the request open, and stop paying if every caller leaves.
    { timeout: UPSTREAM.timeoutMs, maxRetries: UPSTREAM.maxRetries, signal: options.signal },
  );

  if (res.stop_reason === "refusal") {
    return { ok: false, status: HTTP.unprocessable, error: MESSAGES.modelDeclined };
  }
  if (res.stop_reason !== "end_turn") {
    return { ok: false, status: HTTP.badGateway, error: MESSAGES.parseFailed };
  }

  // Model output is untrusted: repair the two harmless slips, then re-validate strictly before it
  // reaches the client.
  const raw = ModelTripSchema.safeParse(res.parsed_output);
  if (!raw.success) return { ok: false, status: HTTP.badGateway, error: MESSAGES.parseFailed };
  const trip = TripSchema.safeParse(normalizeModelTrip(raw.data));
  if (!trip.success) return { ok: false, status: HTTP.badGateway, error: MESSAGES.parseFailed };

  return { ok: true, trip: { ...trip.data, missing_fields: missingFields(trip.data) } };
}
