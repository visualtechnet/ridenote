/** @jest-environment node */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SKIP = new Set(["node_modules", ".next"]);
const AGENT_IMPORT =
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](?:@\/lib\/agent|(?:\.{1,2}\/)+(?:lib\/)?agent)(?:\/[^"']*)?["']/;

/** True when the file starts with "use client" and imports from lib/agent (by alias or by relative path). */
function isOffender(path: string, source: string): boolean {
  const firstStatement = source.replace(/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "");
  if (!/^["']use client["']/.test(firstStatement)) return false;
  if (AGENT_IMPORT.test(source)) return true;
  // A relative path counts only when it resolves into lib/agent from this file's folder.
  const here = join(ROOT, path, "..");
  const relatives = [...source.matchAll(/from\s+["'](\.{1,2}\/[^"']*)["']/g)].map((m) => m[1]);
  return relatives.some((r) =>
    relative(ROOT, join(here, r)).split("\\").join("/").startsWith("lib/agent"),
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("the browser boundary", () => {
  it("no browser file imports the agent tools or the rider fixtures", () => {
    const files = ["app", "components", "lib"].flatMap((d) => sourceFiles(join(ROOT, d)));
    expect(files.length).toBeGreaterThan(50);
    const offenders = files
      .filter((f) => isOffender(relative(ROOT, f), readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("the checker can fail: it flags a client file that imports the agent", () => {
    const alias = '"use client";\nimport { RIDERS } from "@/lib/agent/riders";\n';
    const relativeImport = "'use client'\nimport { runTool } from '../lib/agent/tools';\n";
    expect(isOffender("components/Bad.tsx", alias)).toBe(true);
    expect(isOffender("components/Bad.tsx", relativeImport)).toBe(true);
  });

  it("the checker leaves a server file and an unrelated client import alone", () => {
    expect(isOffender("app/api/x/route.ts", 'import { runTool } from "@/lib/agent/tools";\n')).toBe(
      false,
    );
    expect(isOffender("components/Ok.tsx", '"use client";\nimport { z } from "@/lib/zod";\n')).toBe(
      false,
    );
  });
});
