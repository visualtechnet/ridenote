/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// Cheap guards for the mistakes that are costly to undo once pushed: a key in the repo, a file that
// should be ignored, or a dangerous way of rendering text. They look at what git tracks, not the
// whole folder, so a local .env.local never trips them.
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter(
    (f) => !f.startsWith(".agents/") && !f.startsWith(".claude/") && f !== "package-lock.json",
  );
const text = (file: string) => readFileSync(file, "utf8");
const isTest = (f: string) => /\.test\.tsx?$/.test(f) || f.startsWith("e2e/");
const source = tracked.filter((f) => /^(app|components|lib)\/.*\.tsx?$/.test(f) && !isTest(f));

describe("secrets", () => {
  it("no tracked file contains something shaped like a real Anthropic key", () => {
    // Fake keys in tests start "sk-ant-fake"; anything else long enough is treated as real.
    const pattern = /sk-ant-(?!fake)[A-Za-z0-9_-]{20,}/;
    const offenders = tracked.filter(
      (f) => !/\.(png|ico|jpg|woff2?)$/.test(f) && pattern.test(text(f)),
    );
    expect(offenders).toEqual([]);
  });

  it("the only env file in git is the placeholder template", () => {
    expect(tracked.filter((f) => /(^|\/)\.env/.test(f))).toEqual([".env.example"]);
  });

  it("the template holds no value for the key", () => {
    expect(text(".env.example")).toMatch(/^ANTHROPIC_API_KEY=$/m);
  });

  it("git ignores .env.local and other env files", () => {
    const ignored = execFileSync("git", ["check-ignore", ".env.local", ".env.production"], {
      encoding: "utf8",
    });
    expect(ignored).toContain(".env.local");
    expect(ignored).toContain(".env.production");
  });

  it("the key is never given a NEXT_PUBLIC_ name, which would send it to every browser", () => {
    const offenders = tracked.filter(
      (f) =>
        !isTest(f) &&
        /NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN)/.test(text(f)) &&
        f !== "tests/repo-hygiene.test.ts",
    );
    expect(offenders.filter((f) => !/\.(md|example)$/.test(f))).toEqual([]);
  });
});

describe("dangerous ways to render text", () => {
  it.each(["dangerouslySetInnerHTML", "innerHTML", "eval(", "new Function(", "document.write"])(
    "app code never uses %s",
    (sink) => {
      expect(source.filter((f) => text(f).includes(sink))).toEqual([]);
    },
  );

  it("the API route never passes the note to a shell or the file system", () => {
    const route = text("app/api/parse/route.ts");
    expect(route).not.toMatch(/child_process|\bexec(Sync)?\(|\bspawn\(|node:fs|readFile|writeFile/);
  });
});

describe("repository automation", () => {
  const ci = text(".github/workflows/ci.yml");

  it("CI runs with read-only repository permissions", () => {
    expect(ci).toMatch(/^permissions:\s*\n\s+contents: read/m);
  });

  it("CI installs from the lockfile without running dependency scripts, and audits", () => {
    expect(ci).toContain("npm ci --ignore-scripts");
    expect(ci).toContain("npm audit");
  });

  it("dependabot keeps npm packages and the CI actions up to date", () => {
    expect(existsSync(".github/dependabot.yml")).toBe(true);
    const config = text(".github/dependabot.yml");
    expect(config).toContain("package-ecosystem: npm");
    expect(config).toContain("package-ecosystem: github-actions");
  });

  it("the pre-commit hook refuses env files", () => {
    expect(text(".githooks/pre-commit")).toMatch(/\.env/);
  });
});

describe("security policy", () => {
  it("SECURITY.md says how to report a problem and what not to include", () => {
    const policy = text("SECURITY.md");
    expect(policy).toMatch(/report/i);
    expect(policy).toContain("5761860+visualtechnet@users.noreply.github.com");
    expect(policy).toMatch(/never include .*key/i);
  });
});
