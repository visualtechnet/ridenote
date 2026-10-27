/** @jest-environment node */
import { countTests, readTestCatalog } from "./test-catalog";

describe("test catalog", () => {
  const files = readTestCatalog();

  it("finds this project's test files and their test names", () => {
    expect(files.map((f) => f.file)).toContain("lib/validation.test.ts");
    expect(countTests(files)).toBeGreaterThan(50);
  });

  it("classifies files by layer", () => {
    const kind = (file: string) => files.find((f) => f.file === file)?.kind;
    expect(kind("lib/validation.test.ts")).toBe("Unit");
    expect(kind("components/NoteForm.test.tsx")).toBe("Component");
    expect(kind("tests/a11y.test.tsx")).toBe("Accessibility");
  });

  it("returns nothing, rather than throwing, for a folder with no tests", () => {
    expect(readTestCatalog("/nonexistent-folder")).toEqual([]);
  });
});

describe("test catalog parsing", () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = jest.requireActual("node:fs");
  const { tmpdir } = jest.requireActual("node:os");
  const path = jest.requireActual("node:path");

  it("handles tests outside any describe, escaped quotes, and files with no tests", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catalog-"));
    mkdirSync(path.join(root, "lib"));
    writeFileSync(
      path.join(root, "lib", "a.test.ts"),
      [
        `it("runs on its own", () => {});`,
        `describe("group", () => {`,
        `  it('says \\'hi\\'', () => {});`,
        `  test("another", () => {});`,
        `});`,
      ].join("\n"),
    );
    writeFileSync(path.join(root, "lib", "empty.test.ts"), "// nothing here\n");

    const files = readTestCatalog(root);
    const a = files.find((f) => f.file === "lib/a.test.ts")!;
    expect(a.groups).toEqual([
      { name: "Tests", tests: ["runs on its own"] },
      { name: "group", tests: ["says 'hi'", "another"] },
    ]);
    expect(files.find((f) => f.file === "lib/empty.test.ts")!.groups).toEqual([]);
  });
});
