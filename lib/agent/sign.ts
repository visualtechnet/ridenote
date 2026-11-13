import { createHmac, timingSafeEqual } from "node:crypto";
import { AGENT } from "../config";

/** JSON with object keys sorted at every depth and no spacing, so equal payloads sign equally. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v === null || typeof v !== "object" || Array.isArray(v)) return v;
    const object = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(object)
        .sort()
        .map((k) => [k, object[k]]),
    );
  });
}

/** What a signed token is for. A token of one kind is never accepted as the other. */
export type TokenKind = "draft" | "resume";

const hmac = (body: string, secret: string) =>
  createHmac("sha256", secret).update(body).digest("base64url");

/**
 * `base64url(canonicalJson(payload)).base64url(HMAC-SHA256(secret, first part))`.
 * The one throw in lib/agent/: a short secret is a set-up mistake by the caller, not a tool failure.
 */
export function sign(payload: { exp: number } & Record<string, unknown>, secret: string): string {
  if (secret.length < AGENT.secretMinLength) {
    throw new Error(`The signing secret must be at least ${AGENT.secretMinLength} characters.`);
  }
  const body = Buffer.from(canonicalJson(payload)).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}

export type Verified<T> =
  { ok: true; payload: T } | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

const PART = /^[A-Za-z0-9_-]+$/;

export function verify<T extends { exp: number }>(
  token: string,
  secret: string,
  now: Date,
  kind: TokenKind,
): Verified<T> {
  if (secret.length < AGENT.secretMinLength) return { ok: false, reason: "bad_signature" };
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every((p) => PART.test(p))) {
    return { ok: false, reason: "malformed" };
  }
  const [body, signature] = parts;
  const given = Buffer.from(signature);
  const expected = Buffer.from(hmac(body, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    typeof (payload as { exp?: unknown }).exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }
  if ((payload as { kind?: unknown }).kind !== kind) return { ok: false, reason: "malformed" };
  const typed = payload as T;
  if (!(typed.exp > now.getTime())) return { ok: false, reason: "expired" };
  return { ok: true, payload: typed };
}
