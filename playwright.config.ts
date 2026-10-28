import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Production-like History and rate limit, with an in-memory store and a stubbed model. Never
    // set these anywhere but here: the stub refuses to run on a production build.
    env: {
      VERCEL_ENV: "production",
      HISTORY_DATABASE_URL: "memory://test",
      HISTORY_STORE: "memory",
      CRON_SECRET: "e2e-secret",
      E2E_STUB_PARSE: "1",
    },
  },
});
