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

  it("says a search that finds no rider does not count toward the repeated-mistakes rule", () => {
    expect(doc).toContain("A search that finds no rider is not a mistake, so it does not count.");
    expect(doc).toContain("a search that finds no rider is not one");
  });

  it("quotes the no-rider error as the code words it", () => {
    expect(doc).toContain(
      "No rider matches 'Hector'. Do not search again. Call ask_dispatcher to ask who the rider is.",
    );
  });

  it("explains that the rider's own name before 'usual place' means home but someone else's does not", () => {
    expect(doc).toContain("Dorothy Nguyen's usual place");
    expect(doc).toContain("her sister's house");
  });

  it("reports the first live runs honestly, with the caveat that the cases were tuned on", () => {
    expect(doc).toContain("**9 of 9**");
    expect(doc).toContain("Read this before trusting the 9 of 9.");
    expect(doc).toContain("new cases the code has not been tuned to");
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

  it("does not claim records never hold model text, or that every word is checked", () => {
    expect(doc).not.toMatch(/never\*\* holds the dispatcher's note or\s+any text the model wrote/);
    expect(doc).not.toMatch(/never the content of a trip/);
    expect(doc).not.toMatch(/the record really is what happened/);
    expect(doc).not.toMatch(/a test fails the build if\s+they drift apart/);
    expect(doc).toContain("lib/scrub.ts");
  });

  it("is honest that a short signing secret surfaces as a confusing tool error", () => {
    expect(doc).not.toMatch(/The one place that does throw/);
    expect(doc).toMatch(/no start-up check that the signing secret is long enough/i);
  });

  it("labels design figures as estimates, not measurements", () => {
    expect(doc).not.toMatch(/about three and a half times a typical run/);
    expect(doc).toMatch(/design estimated/i);
  });

  it("explains the two kinds of token and the sidebar name", () => {
    expect(doc).toMatch(/unrelated to the signed draft and resume\s+tokens/i);
    expect(doc).toContain("EVAL_MAX_USD=0.5 npm run eval:agent:key");
    expect(doc).toMatch(/open pull requests/i);
  });

  it("does not bring back three corrected claims", () => {
    expect(doc).not.toMatch(/always says a vehicle is free, except on the 13th/);
    expect(doc).not.toMatch(/The loop catches even that/);
    expect(doc).not.toMatch(/hands the agent a clean,\s+checked trip/);
    expect(doc).not.toMatch(/\|\s*A few cents\s*\|/);
    expect(doc).toContain("runTool");
    expect(doc).toContain("ctx.parsed");
    expect(doc).toMatch(/Expected to be cents; an estimate, no live run yet/);
    expect(doc).toContain("James O'Neil to County Hospital at 9am");
    expect(doc).not.toContain("Sam Whitfield to County Hospital");
  });

  it("explains the guard that refuses to check or propose a trip with no date", () => {
    expect(doc).toContain("No date in the note, no check and no proposal");
    expect(doc).toContain("a rule in code cannot");
    expect(doc).toContain("Three guards live in the code itself");
  });
});
