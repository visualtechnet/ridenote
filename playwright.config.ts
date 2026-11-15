import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E_SERVER=production runs the suite against `next start` on a production build (CI builds first).
 * A production build sends the production headers and cannot contain the model stub, so the tests that
 * need the stub skip themselves (see e2e/fixtures.ts), and with no key set nothing can reach the paid API.
 */
const production = process.env.E2E_SERVER === "production";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: production ? `npm run start -- --port ${PORT}` : `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI && !production,
    timeout: 120_000,
    // Production-like History and rate limit, with an in-memory store and (on the dev server) a
    // stubbed model. Never set these anywhere but here: the stub refuses to run on a production build.
    env: {
      VERCEL_ENV: "production",
      HISTORY_DATABASE_URL: "memory://test",
      HISTORY_STORE: "memory",
      CRON_SECRET: "e2e-secret",
      // Browser tests only: signs drafts for the agent. Production sites set their own secret.
      DRAFT_SIGNING_SECRET: "e2e-only-draft-signing-secret-0000000000",
      ...(production ? {} : { E2E_STUB_PARSE: "1" }),
    },
  },
});
