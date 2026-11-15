import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

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
});
