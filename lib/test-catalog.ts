import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type CatalogGroup = { name: string; tests: string[] };
export type CatalogFile = {
  file: string;
  kind: "Unit" | "Component" | "Accessibility" | "Config" | "Eval";
  groups: CatalogGroup[];
};

const ROOTS = ["app", "components", "lib", "tests", "evals"];
const TITLE = /^\s*(describe|it|test)(?:\.each\([^)]*\))?\(\s*(["'`])((?:\\.|(?!\2).)*)\2/;

function findTestFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(/*turbopackIgnore: true*/ dir, entry.name);
    if (entry.isDirectory()) return findTestFiles(full);
    return /\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function kindOf(file: string): CatalogFile["kind"] {
  if (file.startsWith("tests/a11y")) return "Accessibility";
  if (file.startsWith("tests/")) return "Config";
  if (file.startsWith("lib/")) return "Unit";
  if (file.startsWith("evals/")) return "Eval";
  return "Component";
}

/**
 * Reads the real test files and lists their describe/it titles, so the Tests page always matches
 * what actually runs. Only test names are read, never the test bodies.
 */
export function readTestCatalog(root = /*turbopackIgnore: true*/ process.cwd()): CatalogFile[] {
  const files: CatalogFile[] = [];
  for (const dir of ROOTS) {
    let found: string[];
    try {
      found = findTestFiles(path.join(/*turbopackIgnore: true*/ root, dir));
    } catch {
      continue;
    }
    for (const abs of found.sort()) {
      const file = path.relative(root, abs).split(path.sep).join("/");
      const groups: CatalogGroup[] = [];
      let current: CatalogGroup | undefined;
      for (const line of readFileSync(abs, "utf8").split("\n")) {
        const match = TITLE.exec(line);
        if (!match) continue;
        const title = match[3].replace(/\\(["'`\\])/g, "$1");
        if (match[1] === "describe") {
          current = { name: title, tests: [] };
          groups.push(current);
        } else {
          if (!current) groups.push((current = { name: "Tests", tests: [] }));
          current.tests.push(title);
        }
      }
      files.push({ file, kind: kindOf(file), groups: groups.filter((g) => g.tests.length > 0) });
    }
  }
  return files;
}

export function countTests(files: CatalogFile[]): number {
  return files.reduce((n, f) => n + f.groups.reduce((m, g) => m + g.tests.length, 0), 0);
}
