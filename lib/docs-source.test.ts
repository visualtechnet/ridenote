/** @jest-environment node */
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readDoc } from "./docs-source";

function project(files: Record<string, string>) {
  const root = mkdtempSync(path.join(os.tmpdir(), "docs-"));
  mkdirSync(path.join(root, "docs"));
  for (const [name, text] of Object.entries(files))
    writeFileSync(path.join(root, "docs", name), text);
  return root;
}

describe("readDoc", () => {
  it("returns the file's text", () => {
    expect(readDoc("A", project({ "A.md": "# Hi" }))).toBe("# Hi");
  });

  it("fails loudly when the file is missing", () => {
    expect(() => readDoc("Nope", project({}))).toThrow();
  });

  it("fails loudly when the file is empty", () => {
    expect(() => readDoc("A", project({ "A.md": "  \n" }))).toThrow(/empty/);
  });

  it("reads a nested name", () => {
    const root = project({});
    mkdirSync(path.join(root, "docs", "sub"));
    writeFileSync(path.join(root, "docs", "sub", "B.md"), "# B");
    expect(readDoc("sub/B", root)).toBe("# B");
  });

  it("fails loudly for a missing nested file", () => {
    expect(() => readDoc("nope/missing", project({}))).toThrow();
  });

  it("refuses a name that climbs out of docs/ or starts at the root", () => {
    expect(() => readDoc("../README")).toThrow(/name/i);
    expect(() => readDoc("a/../../README")).toThrow(/name/i);
    expect(() => readDoc("/etc/passwd")).toThrow(/name/i);
  });

  it("reads the real guides", () => {
    expect(readDoc("superpowers/plans/2026-10-27-history")).toMatch(/History/);
    expect(readDoc("SUBAGENTS")).toMatch(/subagent/i);
    expect(readDoc("FAQ")).toMatch(/Questions people ask/);
    expect(readDoc("EVAL")).toMatch(/accuracy eval/i);
  });
});
