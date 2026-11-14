import { AGENT } from "../config";

/**
 * Used only where DRAFT_SIGNING_SECRET is not set and the site is not production (development,
 * preview, tests). Long enough to sign, and public, so drafts from it prove nothing.
 */
export const DEVELOPMENT_SECRET = "development-only-draft-secret-not-for-production";

/**
 * The key that signs drafts and resume tokens. Production requires its own secret (at least
 * AGENT.secretMinLength characters) and never falls back to the public one.
 */
export function signingSecret(
  env: Record<string, string | undefined> = process.env,
): { ok: true; secret: string } | { ok: false } {
  const given = env.DRAFT_SIGNING_SECRET?.trim() ?? "";
  const longEnough = given.length >= AGENT.secretMinLength;
  if (env.VERCEL_ENV === "production")
    return longEnough ? { ok: true, secret: given } : { ok: false };
  if (given === "") return { ok: true, secret: DEVELOPMENT_SECRET };
  return longEnough ? { ok: true, secret: given } : { ok: false };
}
