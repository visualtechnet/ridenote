import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { slugify } from "@/lib/markdown";

describe("Performance docs", () => {
  it("has no docs/SCALING.md and nothing links to it", () => {
    expect(existsSync("docs/SCALING.md")).toBe(false);
    const files = execFileSync(
      "git",
      ["ls-files", "README.md", "docs", "app", "components", "lib"],
      {
        encoding: "utf8",
      },
    )
      .split("\n")
      .filter((f) => /\.(md|ts|tsx)$/.test(f) && !f.startsWith("docs/superpowers/"));
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.filter(
      (f) => existsSync(f) && readFileSync(f, "utf8").includes("SCALING.md"),
    );
    expect(offenders).toEqual([]);
  });

  const MOVED = [
    'What does 429 mean, and what does 503 mean? They both say "try later".',
    "Why do two people sending the same note at the same moment cost one AI call?",
    "Why does pressing Parse twice on the same note do nothing?",
    "Why does the rate limit behave oddly on my machine?",
    "Can I change the limits?",
    'It says "This demo has used up its AI budget". What now?',
    "Is it safe to leave the public demo running?",
  ];

  it("keeps the seven moved questions in Performance and links to them from the FAQ", () => {
    const perf = readFileSync("docs/PERFORMANCE.md", "utf8");
    const faq = readFileSync("docs/FAQ.md", "utf8");
    expect(perf).toContain("## Questions about limits and cost");
    for (const q of MOVED) {
      expect(perf).toContain(`### ${q}`);
      // The demo-safety question keeps its safety half in the FAQ, so its heading stays there.
      if (!q.startsWith("Is it safe")) expect(faq).not.toContain(`### ${q}`);
    }
    const links = faq.match(/\/docs\/performance#[a-z0-9-]+/g) ?? [];
    expect(new Set(links).size).toBeGreaterThanOrEqual(7);
    for (const q of MOVED) expect(links).toContain(`/docs/performance#${slugify(q)}`);
  });

  it("every FAQ link into Performance points at a heading that exists", () => {
    const perf = readFileSync("docs/PERFORMANCE.md", "utf8");
    const ids = perf
      .split("\n")
      .filter((l) => /^#{1,3} /.test(l))
      .map((l) => slugify(l.replace(/^#+ +/, "")));
    for (const file of ["docs/FAQ.md", "README.md"]) {
      const anchors = [...readFileSync(file, "utf8").matchAll(/\/docs\/performance#([^)\s]+)/g)];
      for (const [, anchor] of anchors) expect(ids).toContain(anchor);
    }
  });
});
