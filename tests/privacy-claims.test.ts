import { readFileSync } from "node:fs";
import { join } from "node:path";

// Parsed trips are now saved to History, so no document may still say that nothing is stored.
const FILES = [
  "README.md",
  "SECURITY.md",
  "docs/FAQ.md",
  "app/docs/page.tsx",
  "app/requirements/page.tsx",
];
const STALE = /not stored|not saved by this app|are not stored/i;

describe("privacy statements", () => {
  it.each(FILES)("%s does not claim that nothing is stored", (file) => {
    const text = readFileSync(join(process.cwd(), file), "utf8");
    expect(text).not.toMatch(STALE);
  });
});
