/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AGENT_CASES } from "@/evals/agent-cases";
import { PRICES_AS_OF } from "@/evals/prices";
import { AGENT, UPSTREAM } from "@/lib/config";

// docs/AGENT.md is read by people who cannot see the code. Every number and name in it must be the
// one the code uses, or the page is a story.
const doc = readFileSync(join(process.cwd(), "docs/AGENT.md"), "utf8");
const num = (n: number) => n.toLocaleString("en-US");

describe("docs/AGENT.md", () => {
  it("states every agent limit by its real value", () => {
    expect(doc).toContain(`${AGENT.maxSteps} steps`);
    expect(doc).toContain(`${num(AGENT.maxRunTokens)} tokens`);
    expect(doc).toContain(`${AGENT.maxStepTokens} tokens`);
    expect(doc).toContain(`${AGENT.deadlineMs / 1000} seconds`);
    expect(doc).toContain(`${AGENT.maxToolErrors} steps in a row`);
  });

  it("names every eval case, and marks the critical ones", () => {
    for (const c of AGENT_CASES) expect(doc).toContain(c.name);
    const critical = AGENT_CASES.filter((c) => c.critical).length;
    expect(doc).toContain(`${critical} of the ${AGENT_CASES.length} cases are critical`);
  });

  it("names the default model and the date the prices were checked", () => {
    expect(doc).toContain(UPSTREAM.defaultModel);
    expect(doc).toContain(PRICES_AS_OF);
  });

  it("names every way a run can end", () => {
    for (const reason of [
      "proposed",
      "needs_info",
      "step_cap",
      "token_budget",
      "deadline",
      "upstream",
      "refused",
      "cut_off",
      "invalid_tool_input",
      "no_tool_call",
      "aborted",
    ]) {
      expect(doc).toContain(`\`${reason}\``);
    }
  });

  it("says plainly that the route, the page and Approve are not built yet", () => {
    expect(doc).toMatch(/not built yet/i);
    expect(doc).toContain("npm run eval:agent:key");
    expect(doc).toContain("npx jest --config jest.eval.config.mjs evals/parser.eval");
  });
});
