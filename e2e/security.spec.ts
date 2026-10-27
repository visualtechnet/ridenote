import { expect, test } from "@playwright/test";
import { Routes } from "../lib/routes";
import { freshClient } from "./fixtures";

const PAGES = [
  Routes.page("home"),
  Routes.page("docs"),
  Routes.page("docsEval"),
  Routes.page("docsFaq"),
  Routes.page("requirements"),
  Routes.page("tests"),
  Routes.page("contact"),
];

test.describe("security headers, as a real browser receives them", () => {
  for (const route of PAGES) {
    test(`${route} is locked down`, async ({ request }) => {
      const res = await request.get(route);
      const h = res.headers();
      expect(h["content-security-policy"]).toContain("default-src 'self'");
      expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["cross-origin-opener-policy"]).toBe("same-origin");
      expect(h["permissions-policy"]).toContain("camera=()");
      expect(h["x-powered-by"]).toBeUndefined();
    });
  }
});

test.describe("the API from another website's point of view", () => {
  const json = { "Content-Type": "application/json", Origin: "https://evil.example" };

  test("grants no cross-origin access, so another site cannot call it from a visitor's browser", async ({
    request,
  }) => {
    const preflight = await request.fetch(Routes.api("parse"), {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
        ...freshClient(),
      },
    });
    expect(preflight.headers()["access-control-allow-origin"]).toBeUndefined();
    expect(preflight.headers()["access-control-allow-credentials"]).toBeUndefined();

    const res = await request.post(Routes.api("parse"), {
      headers: { ...json, ...freshClient() },
      data: { note: "<script>alert(1)</script>" },
    });
    expect(res.headers()["access-control-allow-origin"]).toBeUndefined();
  });

  test("answers errors with no-store and no framework or stack details", async ({ request }) => {
    const res = await request.post(Routes.api("parse"), {
      headers: { ...json, ...freshClient() },
      data: {},
    });
    expect(res.status()).toBe(400);
    expect(res.headers()["cache-control"]).toBe("no-store");
    const body = await res.text();
    expect(body).not.toMatch(/at \w+ \(|node_modules|\.tsx?:\d+|stack/i);
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });

  test("does not serve source, config or environment files", async ({ request }) => {
    for (const path of [
      "/.env.local",
      "/.env.example",
      "/.git/config",
      "/package.json",
      "/lib/config.ts",
      "/scripts/with-keychain.sh",
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
    }
  });
});
