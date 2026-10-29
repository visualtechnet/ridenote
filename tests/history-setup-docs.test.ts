import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const readme = read("README.md");
const envExample = read(".env.example");
const setup = read("docs/HISTORY-SETUP.md");
const verify = read("db/verify.sql");

function sourceFiles(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) return sourceFiles(rel);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [rel] : [];
  });
}

// HISTORY_STORE is the in-memory stub for tests and e2e, not a setting anyone configures.
const envVars = [
  ...new Set(
    [...sourceFiles("app"), ...sourceFiles("lib")].flatMap((file) =>
      [...read(file).matchAll(/process\.env\.((?:HISTORY|CRON)_[A-Z_]+)/g)].map((m) => m[1]),
    ),
  ),
]
  .filter((name) => name !== "HISTORY_STORE")
  .sort();

describe("History setup documentation", () => {
  it("finds the environment variables the code reads", () => {
    expect(envVars).toEqual(["CRON_SECRET", "HISTORY_DATABASE_URL", "HISTORY_PURGE_DATABASE_URL"]);
  });

  it.each(envVars)("%s is documented in the README, .env.example and the setup guide", (name) => {
    expect(readme).toContain(name);
    expect(envExample).toContain(name);
    expect(setup).toContain(name);
  });

  it("the setup guide covers the key steps", () => {
    for (const phrase of [
      "db/schema.sql",
      "alter role",
      "channel_binding=require",
      "Sensitive",
      "Redeploy",
      "Firewall",
      "/api/parse",
      "Cron Jobs",
      "Reset password",
    ]) {
      expect(setup).toContain(phrase);
    }
  });

  it("cites only official Vercel and Neon documentation", () => {
    const urls = [...setup.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => new URL(m[1]));
    expect(urls.length).toBeGreaterThan(10);
    for (const url of urls) {
      expect(["vercel.com", "neon.com"]).toContain(url.hostname);
      expect(url.protocol).toBe("https:");
    }
  });

  it.each([
    "https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting",
    "https://vercel.com/docs/cli/firewall",
    "https://vercel.com/docs/cron-jobs/manage-cron-jobs",
    "https://vercel.com/docs/environment-variables/shared-environment-variables",
    "https://vercel.com/docs/environment-variables/sensitive-environment-variables",
    "https://vercel.com/docs/deployments/environments",
    "https://vercel.com/docs/cli/integration",
    "https://neon.com/docs/guides/vercel-managed-integration",
  ])("the setup guide links to %s", (url) => {
    expect(setup).toContain(url);
  });

  it("the setup guide holds no real connection string or secret", () => {
    for (const [, credentials] of setup.matchAll(/postgres(?:ql)?:\/\/([^@\s/]+)@/g)) {
      expect(credentials).toMatch(/[A-Z]{3,}|PASSWORD/);
    }
    expect(setup).not.toMatch(/(?:sk-ant-|npg_|gho_)[A-Za-z0-9]/);
  });

  it("the README points to the setup guide", () => {
    expect(readme).toContain("docs/HISTORY-SETUP.md");
  });

  it("verify.sql revokes every role membership it grants", () => {
    const granted = [...verify.matchAll(/GRANT (history_\w+) TO/g)].map((m) => m[1]).sort();
    const revoked = [...verify.matchAll(/REVOKE (history_\w+) FROM/g)].map((m) => m[1]).sort();
    expect(granted).toEqual(["history_app", "history_purge"]);
    expect(revoked).toEqual(granted);
  });

  it("verify.sql resets the role after each SET ROLE", () => {
    expect([...verify.matchAll(/^SET ROLE /gm)].length).toBe(
      [...verify.matchAll(/^RESET ROLE;/gm)].length,
    );
  });
});
