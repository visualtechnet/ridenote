import { RATE_LIMIT } from "./config";

type Options = { limit: number; windowMs: number; maxKeys?: number; now?: () => number };
type Result = { allowed: boolean; retryAfterSec: number };

/** Per-client limit: the strict one in production, the looser one in development and preview. */
export function maxRequestsFor(
  env: { VERCEL_ENV?: string; [key: string]: string | undefined } = {},
): number {
  return env.VERCEL_ENV === "production"
    ? RATE_LIMIT.maxRequestsProduction
    : RATE_LIMIT.maxRequests;
}

/**
 * Fixed-window limiter held in process memory. On serverless or multi-instance hosts each
 * instance counts separately; back this with a shared store (e.g. Redis) before relying on it.
 */
export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = RATE_LIMIT.maxTrackedClients,
  now = Date.now,
}: Options) {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string): Result {
    const t = now();

    // Make room only for a key we have not seen: a known key already has its slot.
    if (windows.size >= maxKeys && !windows.has(key)) {
      for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
      // Still full of live entries: drop the oldest so memory stays bounded.
      while (windows.size >= maxKeys) windows.delete(windows.keys().next().value!);
    }

    let w = windows.get(key);
    if (!w || w.resetAt <= t) {
      w = { count: 0, resetAt: t + windowMs };
      windows.set(key, w);
    }
    w.count += 1;

    return {
      allowed: w.count <= limit,
      retryAfterSec: Math.max(1, Math.ceil((w.resetAt - t) / 1000)),
    };
  };
}
