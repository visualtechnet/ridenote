import { DEVELOPMENT_SECRET, signingSecret } from "./secret";

const LONG = "x".repeat(32);

describe("signingSecret", () => {
  it("uses the development secret outside production when none is set", () => {
    expect(signingSecret({})).toEqual({ ok: true, secret: DEVELOPMENT_SECRET });
  });

  it("uses a long secret from the environment outside production", () => {
    expect(signingSecret({ DRAFT_SIGNING_SECRET: LONG })).toEqual({ ok: true, secret: LONG });
  });

  it("refuses a short secret outside production rather than signing with it", () => {
    expect(signingSecret({ DRAFT_SIGNING_SECRET: "short" })).toEqual({ ok: false });
  });

  it("requires its own secret in production and never falls back to the public one", () => {
    expect(signingSecret({ VERCEL_ENV: "production" })).toEqual({ ok: false });
    expect(signingSecret({ VERCEL_ENV: "production", DRAFT_SIGNING_SECRET: "short" })).toEqual({
      ok: false,
    });
    expect(signingSecret({ VERCEL_ENV: "production", DRAFT_SIGNING_SECRET: LONG })).toEqual({
      ok: true,
      secret: LONG,
    });
  });

  it("reads the process environment by default", () => {
    expect(signingSecret().ok).toBe(true);
  });
});
