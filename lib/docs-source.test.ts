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

  it("reads the real guides", () => {
    expect(readDoc("FAQ")).toMatch(/Questions people ask/);
    expect(readDoc("EVAL")).toMatch(/accuracy eval/i);
  });
});
