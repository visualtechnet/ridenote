/** @jest-environment node */
import nextConfig from "../next.config";

describe("security headers", () => {
  it("sets hardening headers on every route", async () => {
    const rules = await nextConfig.headers!();
    const rule = rules.find((r) => r.source === "/(.*)")!;
    const h = Object.fromEntries(rule.headers.map((x) => [x.key, x.value]));

    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
  });

  it("ships a CSP that blocks framing, plugins, and third-party connections", async () => {
    const rules = await nextConfig.headers!();
    const csp = rules[0].headers.find((x) => x.key === "Content-Security-Policy")!.value;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toMatch(/(^|[\s;])\*([\s;]|$)/); // no bare wildcard source
  });

  describe("HSTS", () => {
    const env = process.env as Record<string, string | undefined>;
    const original = env.NODE_ENV;
    afterEach(() => {
      env.NODE_ENV = original;
    });

    async function hstsIn(nodeEnv: string) {
      env.NODE_ENV = nodeEnv;
      let value: string | undefined;
      await jest.isolateModulesAsync(async () => {
        const config = (await import("../next.config")).default;
        const rules = await config.headers!();
        value = rules[0].headers.find((x) => x.key === "Strict-Transport-Security")?.value;
      });
      return value;
    }

    it("is sent in production, without includeSubDomains", async () => {
      const value = await hstsIn("production");
      expect(value).toContain("max-age=");
      expect(value).not.toMatch(/includeSubDomains/i);
    });

    it("is not sent in development, so localhost is never pinned to HTTPS", async () => {
      expect(await hstsIn("development")).toBeUndefined();
    });
  });
});
