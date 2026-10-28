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

// Per-call usage (token counts, stop reason, latency) is now logged, so docs must not claim that
// logs hold only an error type.
const STALE_LOGS = /(logs? record|log) only an error\s+_?type/i;

describe("logging statements", () => {
  it.each(["docs/FAQ.md", "app/docs/page.tsx"])("%s mentions the usage log line", (file) => {
    const text = readFileSync(join(process.cwd(), file), "utf8").replace(/\s+/g, " ");
    expect(text).not.toMatch(STALE_LOGS);
    expect(text).toMatch(/token counts, stop reason and latency/i);
  });
});
