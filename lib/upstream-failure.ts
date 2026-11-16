import { isOutOfCredit } from "./upstream-errors";

/**
 * How a failed paid call should be answered. The person can act on "out of credit"; "busy" and
 * "misconfigured" are our side or the provider's, so they are a 503 (try later), not a 502 (bad
 * answer). "failed" covers everything else: a bad answer, a bad request, or a dropped connection.
 */
export type UpstreamFailure = "out_of_credit" | "busy" | "misconfigured" | "failed";

/** The HTTP status the SDK attached to a provider error, or undefined for a network-level error. */
function providerStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

export function classifyUpstreamFailure(err: unknown): UpstreamFailure {
  if (isOutOfCredit(err)) return "out_of_credit";
  const status = providerStatus(err);
  // 429 rate limit, 529 overloaded, and the transient 5xx codes: the provider is saturated.
  if (status === 429 || status === 500 || status === 503 || status === 529) return "busy";
  // A bad or missing key is a set-up fault on our side, never the person's fault.
  if (status === 401 || status === 403) return "misconfigured";
  return "failed";
}
