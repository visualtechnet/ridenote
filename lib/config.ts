/** Every tunable number and name lives here, so nothing is hardcoded in the code that uses it. */

export const LIMITS = {
  noteMin: 5,
  // A dispatcher note is a few sentences (roughly 100 to 400 characters). 1,000 leaves room for a
  // pasted email snippet while keeping every request cheap: cost grows with input length.
  noteMax: 1000,
  // 1,000 characters even if every one is written as a 6-byte JSON escape (\uXXXX) is 6,000 bytes,
  // plus the {"note":""} wrapper. 8 KB covers that with headroom and nothing more.
  bodyMaxBytes: 8_192,
} as const;

export const RATE_LIMIT = {
  /** Per client, counting every request, valid or not, so junk traffic is throttled too. */
  maxRequests: 10,
  windowMs: 60_000,
  maxTrackedClients: 10_000,
} as const;

/**
 * Limits on the paid upstream call, shared by everyone. Per-client limits stop one noisy client;
 * these stop many quiet ones (a distributed flood) from running up the bill or exhausting the host.
 */
export const BUDGET = {
  /** Upstream calls per window across all clients. Beyond this the API answers 503. */
  maxCallsPerWindow: 300,
  windowMs: 60_000,
  /** Upstream calls running at the same moment in one server instance. */
  maxConcurrent: 10,
} as const;

export const UPSTREAM = {
  defaultModel: "claude-haiku-5-5",
  modelEnvVar: "MODEL",
  // Measured: a trip answer averages about 160 tokens, and the schema caps the worst case near 450. A
  // tight ceiling caps the cost of a runaway or manipulated answer. This only holds with reasoning
  // off (below): with it on, the same notes averaged 550 tokens and tricky ones used up the whole cap.
  maxTokens: 600,
  // Extraction needs no hidden reasoning. With it on, the model spent most of its tokens thinking, a
  // tricky note could run out of tokens before the JSON was written (a cut-off answer became a 502),
  // and it cost about 3.5 times as much. With it off, 30 of 30 runs of a hostile note resisted it.
  thinking: { type: "disabled" } as const,
  timeoutMs: 30_000,
  maxRetries: 1,
} as const;

/** The browser gives up after the server's own worst case (timeout x attempts) plus headroom. */
export const CLIENT = {
  timeoutMs: UPSTREAM.timeoutMs * (UPSTREAM.maxRetries + 1) + 5_000,
} as const;

export const HTTP = {
  ok: 200,
  badRequest: 400,
  payloadTooLarge: 413,
  unsupportedMediaType: 415,
  unprocessable: 422,
  tooManyRequests: 429,
  badGateway: 502,
  unavailable: 503,
  clientClosed: 499,
} as const;

/**
 * How a passenger gets around, as a list of these. An empty list means the note did not say.
 * "ambulatory" means walks with no aid and stands alone; the rest are aids and can be combined.
 * "other" is for an aid that fits none of the others, described in the trip's notes.
 */
export const MOBILITY = [
  "ambulatory",
  "wheelchair",
  "stretcher",
  "walker",
  "cane",
  "crutches",
  "scooter",
  "other",
] as const;

/** Fields a trip needs before it can be dispatched. Used to compute what's missing. */
export const REQUIRED_TRIP_FIELDS = [
  "passenger_name",
  "pickup_location",
  "dropoff_location",
  "pickup_time",
] as const;

/** Maximum lengths for text the model returns (we never trust model output blindly). */
export const OUTPUT_LIMITS = {
  name: 200,
  location: 300,
  notes: 300,
  fieldName: 40,
  missingFieldCount: 10,
  mobilityCount: MOBILITY.length,
} as const;

/** Where visitors write with questions or feedback. Shown on the Contact page. API keys are not provided. */
export const CONTACT = {
  email: "5761860+visualtechnet@users.noreply.github.com",
  subject: "RideNote",
} as const;
