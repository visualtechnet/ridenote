import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { HTTP, UPSTREAM } from "./config";
import { MESSAGES } from "./messages";
import { SYSTEM, wrapNote } from "./prompt";
import { ModelTripSchema, TripSchema, missingFields, normalizeModelTrip, type Trip } from "./trip";

/** What one paid model call cost and how it ended. Numbers and labels only, never note content. */
export type CallMeta = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  stopReason: string | null;
  latencyMs: number;
};

export type Extraction = (
  { ok: true; trip: Trip } | { ok: false; status: number; error: string }
) & { meta: CallMeta };

/**
 * The one model call, shared by the API route and the eval suite so both test the same prompt,
 * schema and validation. Throws if the SDK itself fails (network, timeout, abort).
 */
export async function extractTrip(
  client: Pick<Anthropic, "messages">,
  note: string,
  options: { signal?: AbortSignal } = {},
): Promise<Extraction> {
  const model = process.env[UPSTREAM.modelEnvVar] ?? UPSTREAM.defaultModel;
  const started = performance.now();
  const res = await client.messages.parse(
    {
      model,
      max_tokens: UPSTREAM.maxTokens,
      thinking: UPSTREAM.thinking,
      system: SYSTEM,
      messages: [{ role: "user", content: wrapNote(note) }],
      output_config: { format: zodOutputFormat(ModelTripSchema) },
    },
    // Don't let a hung upstream hold the request open, and stop paying if every caller leaves.
    { timeout: UPSTREAM.timeoutMs, maxRetries: UPSTREAM.maxRetries, signal: options.signal },
  );

  const meta: CallMeta = {
    model,
    inputTokens: res.usage?.input_tokens ?? 0,
    outputTokens: res.usage?.output_tokens ?? 0,
    cacheRead: res.usage?.cache_read_input_tokens ?? 0,
    cacheWrite: res.usage?.cache_creation_input_tokens ?? 0,
    stopReason: res.stop_reason,
    latencyMs: Math.round(performance.now() - started),
  };

  if (res.stop_reason === "refusal") {
    return { ok: false, status: HTTP.unprocessable, error: MESSAGES.modelDeclined, meta };
  }
  if (res.stop_reason !== "end_turn") {
    return { ok: false, status: HTTP.badGateway, error: MESSAGES.parseFailed, meta };
  }

  // Model output is untrusted: repair the two harmless slips, then re-validate strictly before it
  // reaches the client.
  const raw = ModelTripSchema.safeParse(res.parsed_output);
  if (!raw.success) {
    return { ok: false, status: HTTP.badGateway, error: MESSAGES.parseFailed, meta };
  }
  const trip = TripSchema.safeParse({ ...normalizeModelTrip(raw.data), missing_fields: [] });
  if (!trip.success) {
    return { ok: false, status: HTTP.badGateway, error: MESSAGES.parseFailed, meta };
  }

  return { ok: true, trip: { ...trip.data, missing_fields: missingFields(trip.data) }, meta };
}
