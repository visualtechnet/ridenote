import { timingSafeEqual } from "node:crypto";
import { HISTORY, HTTP } from "@/lib/config";
import { historyEnabled } from "@/lib/history";
import { getPurger } from "@/lib/history-purge";
import { MESSAGES } from "@/lib/messages";

function json(body: unknown, status: number = HTTP.ok) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * True only for the exact header `Bearer <CRON_SECRET>`. The comparison takes the same time
 * wherever the two differ, and an unset or empty secret matches nothing: without that, a request
 * with no header could "equal" an empty secret.
 */
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // timingSafeEqual throws on different lengths, so compare those first.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily clean-up, called by the Vercel cron in vercel.json. It reads the request header and the
 * environment, so Next never caches or prerenders it. The delete itself lives in lib/history-purge.ts.
 */
export async function GET(req: Request) {
  // The secret comes first: nothing else about this route is revealed to a caller without it.
  if (!isAuthorized(req)) return json({ error: MESSAGES.unauthorized }, HTTP.unauthorized);
  if (!historyEnabled()) return json({ deleted: 0, skipped: true });

  try {
    const deleted = await getPurger().purgeOlderThan(HISTORY.retentionDays);
    return json({ deleted });
  } catch (err) {
    // Error name only: driver messages can carry connection details or row content.
    console.error("history purge failed:", err instanceof Error ? err.name : "unknown error");
    return json({ error: MESSAGES.purgeFailed }, HTTP.serverError);
  }
}
