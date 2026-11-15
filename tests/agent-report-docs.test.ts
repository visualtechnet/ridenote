import { readdirSync, readFileSync } from "node:fs";
import { formatTable, type AgentRow } from "@/evals/agent-results";

const DIR = "evals/agent-results";
const REPORT = "2026-11-14-claude-haiku-5-5-final-pre-merge.json";
const read = (name: string) =>
  JSON.parse(readFileSync(`${DIR}/${name}`, "utf8")) as {
    model: string;
    cases: number;
    passed: number;
    rows: AgentRow[];
  };
const doc = readFileSync("docs/EVAL.md", "utf8");

describe("Agent eval report docs", () => {
  it("embeds the table the eval harness prints for the report run", () => {
    const file = read(REPORT);
    const table = formatTable(file.rows, file.model);
    expect(doc).toContain(`\`\`\`text\n${table}\n\`\`\``);
  });

  it("lists the pass count of each committed run in the history table", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const name of files) {
      const { passed, cases } = read(name);
      const line = doc.split("\n").find((l) => l.includes(`\`${name}\``));
      expect(line).toBeDefined();
      expect(line).toContain(`${passed} of ${cases}`);
    }
  });
});
