import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Reads a guide from docs/ at build time, so the site shows exactly what the repository holds.
 * A missing or empty file throws and fails the build: a docs page that quietly says nothing is
 * worse than no page (the same rule as the Tests page).
 */
export function readDoc(name: string, root = /*turbopackIgnore: true*/ process.cwd()): string {
  const file = path.join(/*turbopackIgnore: true*/ root, "docs", `${name}.md`);
  const text = readFileSync(file, "utf8");
  if (!text.trim()) throw new Error(`docs/${name}.md is empty.`);
  return text;
}
