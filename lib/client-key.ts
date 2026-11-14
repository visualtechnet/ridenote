/** The key a request is counted under for rate limits. Shared by every route that rate limits. */
export const UNKNOWN_CLIENT = "unknown";

/**
 * Never key on the first x-forwarded-for entry: the client writes it. x-real-ip is set by the
 * hosting platform (e.g. Vercel); otherwise take the last hop, which our own proxy appended.
 */
export function clientKey(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || UNKNOWN_CLIENT;
}
