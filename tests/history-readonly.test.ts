import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

// Statements, not bare words, so a comment that says "delete" cannot trip it.
const WRITE_STATEMENT =
  /\b(UPDATE\s+\w+\s+SET|DELETE\s+FROM|TRUNCATE\s+(TABLE\s+)?\w+|DROP\s+TABLE)\b/i;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

const isCode = (f: string) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f);

const historyFiles = [
  ...fs
    .readdirSync(path.join(root, "lib"))
    .filter((f) => f.startsWith("history") && isCode(f))
    .map((f) => path.join(root, "lib", f)),
  ...walk(path.join(root, "app", "api", "history")).filter(isCode),
];

describe("history code is read-only apart from the purge module", () => {
  it("finds the history files", () => {
    expect(historyFiles.length).toBeGreaterThan(3);
  });

  it("contains UPDATE, DELETE, TRUNCATE or DROP statements only in lib/history-purge.ts", () => {
    const offenders = historyFiles
      .filter((f) => WRITE_STATEMENT.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual(["lib/history-purge.ts"]);
  });
});

describe("db/schema.sql", () => {
  const sql = fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8");
  const code = sql.replace(/--.*$/gm, "");

  it("grants the app role INSERT, SELECT and the purge role SELECT, DELETE", () => {
    expect(code).toMatch(/GRANT\s+INSERT,\s*SELECT\s+ON\s+history\s+TO\s+history_app/i);
    expect(code).toMatch(/GRANT\s+SELECT,\s*DELETE\s+ON\s+history\s+TO\s+history_purge/i);
  });

  it("sets no password", () => {
    expect(code).not.toMatch(/password/i);
  });
});
