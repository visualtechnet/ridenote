import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Clock } from "./clock";
import { HTTP, OUTPUT_LIMITS, UPSTREAM, thinkingFor } from "./config";
import { checkPickupDate } from "./dates";
import { MESSAGES } from "./messages";
import { systemPrompt, wrapNote } from "./prompt";
import {
  ModelTripSchema,
  TripSchema,
  clampText,
  missingFields,
  normalizeModelTrip,
  type Trip,
} from "./trip";

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

/** The first text block of a reply, or "" when it has none (it may open with thinking blocks). */
function firstText(content: Anthropic.ContentBlock[]): string {
  const block = content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return block?.text ?? "";
}

/** Parsed JSON, or undefined when the text is not JSON (the schema check then rejects it). */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * The one model call, shared by the API route and the eval suite so both test the same prompt,
 * schema and validation. Throws if the SDK itself fails (network, timeout, abort). The clock is
 * passed in, never read here, so "tomorrow" means the same thing in a test as it did when written.
 */
export async function extractTrip(
  client: Pick<Anthropic, "messages">,
  note: string,
  options: { clock: Clock; signal?: AbortSignal },
): Promise<Extraction> {
  const model = process.env[UPSTREAM.modelEnvVar] ?? UPSTREAM.defaultModel;
  const started = performance.now();
  // create(), not parse(): parse() throws on a cut-off or invalid answer before we can read the
  // usage, and those are the calls that cost the most. We read and validate the JSON ourselves.
  const res = await client.messages.create(
    {
      model,
      max_tokens: UPSTREAM.maxTokens,
      thinking: thinkingFor(model),
      system: systemPrompt(options.clock),
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
  const raw = ModelTripSchema.safeParse(parseJson(firstText(res.content)));
  if (!raw.success) {
    return { ok: false, status: HTTP.badGateway, error: MESSAGES.parseFailed, meta };
  }
  const trip = TripSchema.safeParse({ ...normalizeModelTrip(raw.data), missing_fields: [] });
  if (!trip.success) {
    return { ok: false, status: HTTP.badGateway, error: MESSAGES.parseFailed, meta };
  }

  // The model resolves the date; code decides whether it can stand (real, in the window, on the
  // named weekday). A cleared date puts its reason first in notes, where a person will read it.
  const date = checkPickupDate(trip.data.pickup_date, note, options.clock);
  const notes = date.reason
    ? clampText([date.reason, trip.data.notes].filter(Boolean).join(" "), OUTPUT_LIMITS.notes)
    : trip.data.notes;
  const checked = { ...trip.data, pickup_date: date.date, notes };

  return { ok: true, trip: { ...checked, missing_fields: missingFields(checked) }, meta };
}
