/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { latestResults } from "@/evals/results";
import { UPSTREAM } from "@/lib/config";

// The README's numbers are a claim to a reader who cannot rerun the eval. They must be the numbers in
// the latest committed results file, or the section is a story, not evidence.
const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
const start = readme.indexOf("## How I evaluated this");
const section = start === -1 ? "" : readme.slice(start, readme.indexOf("\n## ", start + 1));

describe("README: How I evaluated this", () => {
  const haiku = latestResults(UPSTREAM.defaultModel);
  const sonnet = latestResults("claude-sonnet-5-5");

  it("exists, and quotes the latest results file for the default model", () => {
    expect(section).not.toBe("");
    expect(haiku).not.toBeNull();
    expect(section).toContain(UPSTREAM.defaultModel);
    expect(section).toContain(`${haiku!.passed} of ${haiku!.cases}`);
  });

  it("names at least one honest failure that really fails in the latest run", () => {
    const failing = haiku!.rows.filter((r) => !r.pass).map((r) => r.name);
    if (failing.length === 0) {
      expect(section).toMatch(/every case passed/i);
      return;
    }
    expect(failing.some((name) => section.includes(name))).toBe(true);
  });

  it("quotes the latest results file for the comparison model", () => {
    expect(sonnet).not.toBeNull();
    expect(section).toContain("claude-sonnet-5-5");
    expect(section).toContain(`${sonnet!.passed} of ${sonnet!.cases}`);
  });
});
