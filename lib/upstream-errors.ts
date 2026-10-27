/**
 * Did the AI service refuse because the account has no credit or hit its spend limit?
 *
 * This is the one upstream failure the person using the page can act on (come back later, or run
 * the app with their own key), so it gets its own message instead of "try again". It is told apart
 * from other failures by the HTTP status and the error `type`/message fields the SDK exposes. It
 * checks those fields rather than using `instanceof`, which is unreliable across environments
 * (see FAQ #22), and a plain Error with no status never matches.
 */
export function isOutOfCredit(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { status, type, message } = err as { status?: unknown; type?: unknown; message?: unknown };
  if (typeof status !== "number") return false;
  if (type === "billing_error" || status === 402) return true;
  return (
    status === 400 &&
    typeof message === "string" &&
    /credit balance|usage limits?|spend(ing)? limit/i.test(message)
  );
}
