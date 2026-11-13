/** @jest-environment node */
import { createHmac } from "node:crypto";
import { canonicalJson, sign, verify } from "./sign";

const secret = "s".repeat(32);
const now = new Date("2026-11-02T15:00:00Z");
const exp = now.getTime() + 900_000;

function flipChar(text: string, index: number): string {
  const replacement = text[index] === "A" ? "B" : "A";
  return text.slice(0, index) + replacement + text.slice(index + 1);
}

/** Builds a token from raw text with the real HMAC, so the signature passes and the payload check is reached. */
function signRaw(raw: string, key: string): string {
  const body = Buffer.from(raw).toString("base64url");
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
}

describe("canonicalJson", () => {
  it("sorts object keys at every depth with no spacing", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      '{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}',
    );
  });
  it("writes scalars and null as plain JSON", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson("x")).toBe('"x"');
    expect(canonicalJson(7)).toBe("7");
  });
});

describe("sign and verify", () => {
  const token = sign({ exp, draft_id: "d1" }, secret);

  it("round-trips a payload", () => {
    expect(verify(token, secret, now)).toEqual({ ok: true, payload: { exp, draft_id: "d1" } });
  });
  it("does not depend on key order", () => {
    expect(sign({ draft_id: "d1", exp }, secret)).toBe(token);
  });
  it("rejects one changed character in the payload part", () => {
    expect(verify(flipChar(token, 3), secret, now)).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("rejects one changed character in the signature part", () => {
    expect(verify(flipChar(token, token.length - 2), secret, now)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });
  it("rejects a different secret", () => {
    expect(verify(token, "t".repeat(32), now)).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("rejects a signature of the wrong length", () => {
    const [body] = token.split(".");
    expect(verify(`${body}.AAAA`, secret, now)).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("expires at exp, not before", () => {
    expect(verify(token, secret, new Date(exp))).toEqual({ ok: false, reason: "expired" });
    expect(verify(token, secret, new Date(exp - 1)).ok).toBe(true);
  });
  it.each(["", "abc", "a.b.c", ".", "a.", ".b", "!!!.???"])("the text %j is malformed", (t) =>
    expect(verify(t, secret, now)).toEqual({ ok: false, reason: "malformed" }),
  );
  it("rejects a correctly signed token that is not an object payload", () => {
    expect(verify(signRaw('"text"', secret), secret, now).ok).toBe(false);
    expect(verify(signRaw("null", secret), secret, now)).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(verify(signRaw("[1]", secret), secret, now)).toEqual({ ok: false, reason: "malformed" });
    expect(verify(signRaw("not json", secret), secret, now)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
  it("rejects a correctly signed payload with no numeric exp", () => {
    expect(verify(signRaw('{"draft_id":"d1"}', secret), secret, now)).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(verify(signRaw('{"exp":"soon"}', secret), secret, now)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
  it("refuses to sign with a short secret", () => {
    expect(() => sign({ exp }, "short")).toThrow();
  });
});
