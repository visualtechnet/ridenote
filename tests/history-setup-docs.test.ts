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
