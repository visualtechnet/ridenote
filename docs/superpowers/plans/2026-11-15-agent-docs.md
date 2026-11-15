# Agent docs (Plan D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the week 5 docs sub-task: a Performance page that holds every cost and performance topic (including the agent's), an agent eval report built from real committed results, the README, Requirements page and FAQ updates, so the status table can say "Built".

**Architecture:** Docs are markdown files in `docs/` rendered by `lib/docs-source.ts` `readDoc(name)` into pages under `app/docs/`. The Performance page is `docs/SCALING.md` moved to `docs/PERFORMANCE.md` plus the seven FAQ answers the design names plus a new agent section. Every number a doc quotes is pinned by a test that reads `lib/config.ts` or a committed results file, so a doc cannot go stale quietly (FAQ mistake 25).

**Tech Stack:** Next.js 16 App Router, markdown docs, Jest and Testing Library, jest-axe.

**Spec:** `docs/superpowers/specs/2026-11-13-agent-tool-calling-loop-prd.md` (week 5 sub-task "Update docs", AL-14, decision 12) and `docs/superpowers/specs/2026-10-29-dispatch-agent-design.md` ("Docs and requirements", lines 354 to 372).

## Global Constraints

- Work only in the worktree `/Users/markguerrero/Solutions/ridenote/.claude/worktrees/agent-docs` (branch `docs/agent-docs`). Never touch `/Users/markguerrero/Solutions/ridenote` itself.
- Docs are written in plain English for a beginner who is new to AI: "not that technical, but not too simple". Define a term the first time it appears. No em dashes.
- Test titles are literal strings (`lib/test-catalog.ts` scans them).
- No live API calls and no live evals. Report numbers come only from committed files in `evals/agent-results/`.
- Every commit passes the pre-commit `npm run check` (do not bypass it). Run `npx prettier --write` on changed files first.
- Commit with explicit paths, never `git add -A`. No Co-Authored-By or any Claude/Anthropic attribution line. No personal email anywhere.
- Do not change `lib/agent/prompt.ts` or `lib/config.ts`.
- Out of scope (separate plans): the tenth live eval case, the signing-secret start-up check, the question-screen "I will type it" dead end, the 2-per-minute limit, the workflow-versus-agent panel.

## Review Focus

- A link or anchor that points at a heading that was moved or renamed (FAQ to Performance): tests check every `/docs/performance#...` link has a heading.
- A removed `docs/SCALING.md` still linked from README, GUIDE or BEST-PRACTICES: a test fails on any remaining reference.
- A quoted number (cost per run, tokens, latency, limits) drifting from the committed results or `lib/config.ts`: tests regenerate the numbers and compare.
- Per-run latency misread: `latencyMs` in a results row is the sum over its `attempts`, so a per-run figure is `latencyMs / attempts`.
- An empty or missing `docs/PERFORMANCE.md` breaking the build: the page test renders it.

---

### Task 1: Performance page and nav (move SCALING into it)

**Files:**

- Move: `docs/SCALING.md` to `docs/PERFORMANCE.md` (use `git mv`, retitle to "Performance, cost and abuse protection")
- Create: `app/docs/performance/page.tsx`, `app/docs/performance/page.test.tsx`
- Modify: `lib/routes.ts`, `lib/messages.ts` (COPY), `components/SideNav.tsx`, `components/SideNav.test.tsx`, `README.md` (lines naming SCALING), `docs/BEST-PRACTICES.md`, `docs/GUIDE.md`, `components/Markdown.tsx` (comment only)
- Test: `tests/performance-docs.test.ts` (create)

**Interfaces:**

- Produces: `Routes.page("docsPerformance")` returns `"/docs/performance"`; `COPY.navDocsPerformance` is `"Performance"`; `readDoc("PERFORMANCE")` works. Side nav order under Docs: Setup, Eval, FAQ, Performance, Agents, How the agent works.

- [ ] **Step 1: Write the failing tests.** In `tests/performance-docs.test.ts`: `it("has no docs/SCALING.md and nothing links to it")` asserts `existsSync("docs/SCALING.md")` is false and no tracked text file (README, `docs/**/*.md` except `docs/superpowers/**`, `app`, `components`, `lib`) contains `SCALING.md`. In `app/docs/performance/page.test.tsx` (copy the shape of `app/docs/agent/page.test.tsx`): one h1 named "Performance, cost and abuse protection", and no axe violations. In `components/SideNav.test.tsx` update the two docs-section assertions to expect the six links in the order above.
- [ ] **Step 2: Run** `npx jest tests/performance-docs app/docs/performance components/SideNav` and confirm they fail.
- [ ] **Step 3: Implement.** `git mv` the file and retitle it; add the route, COPY entry and `SideNav` link (the same pattern as `docsAgent`); add the page (same shape as `app/docs/agent/page.tsx`, with a `metadata` title and description); replace every `docs/SCALING.md` reference with `docs/PERFORMANCE.md` (README lines naming it, BEST-PRACTICES, GUIDE) and update the comment in `Markdown.tsx`. Also add `docs/PERFORMANCE.md` to the README docs table, saying it is also on the site under Docs, Performance.
- [ ] **Step 4: Run** the same command plus `npx jest lib/routes components`. Expected: all pass.
- [ ] **Step 5: Commit** `docs: move SCALING into a Performance page with its own nav entry`.

### Task 2: Move the seven FAQ answers into Performance

**Files:**

- Modify: `docs/FAQ.md`, `docs/PERFORMANCE.md`
- Test: `tests/performance-docs.test.ts`

**Interfaces:**

- Consumes: Task 1's page. The seven FAQ headings to move, verbatim: "What does 429 mean, and what does 503 mean? They both say "try later".", "Why do two people sending the same note at the same moment cost one AI call?", "Why does pressing Parse twice on the same note do nothing?", "Why does the rate limit behave oddly on my machine?", "Can I change the limits?", "It says "This demo has used up its AI budget". What now?", and the cost part of "Is it safe to leave the public demo running?".
- Produces: a new section "Questions about limits and cost" in `docs/PERFORMANCE.md` holding the seven full answers as `###` headings.

- [ ] **Step 1: Write the failing tests** in `tests/performance-docs.test.ts`: `it("keeps the seven moved questions in Performance and links to them from the FAQ")` asserts each heading text is in `docs/PERFORMANCE.md` and not as a `### ` heading in `docs/FAQ.md`, and that `docs/FAQ.md` links to `/docs/performance` for each. `it("every FAQ link into Performance points at a heading that exists")` extracts every `/docs/performance#anchor` link from FAQ and README and asserts the anchor matches a heading under the same slug rule `components/Markdown.tsx` uses (read it; reuse its slug function if exported).
- [ ] **Step 2: Run** `npx jest tests/performance-docs` and confirm failure.
- [ ] **Step 3: Implement.** Move the answers (full text) under the new section. In the FAQ replace each with a one-line question heading kept short and a link, for example "Moved to Performance: [429 versus 503](/docs/performance#...)". The "safe to leave the demo running" entry keeps its safety half and links to the cost half. Check `tests/privacy-claims.test.ts` and `lib/docs-examples.test.ts`: they pin FAQ text, so keep the lines they need.
- [ ] **Step 4: Run** `npx jest tests lib/docs-examples lib/markdown app/docs`. Expected: pass.
- [ ] **Step 5: Commit** `docs: move the limits and cost FAQ answers to the Performance page`.

### Task 3: The agent's performance and security notes

**Files:**

- Modify: `docs/PERFORMANCE.md`
- Test: `tests/performance-docs.test.ts`

**Interfaces:**

- Consumes: `AGENT`, `AGENT_RATE`, `BUDGET` from `lib/config.ts`; the committed file `evals/agent-results/2026-11-14-claude-haiku-5-5-final-pre-merge.json` (summary fields `calls`, `inputTokens`, `outputTokens`, `costUsd`, `meanStepsPerRun`; per-row `attempts`, `latencyMs`).
- Produces: a section "What an agent run costs and how long it takes" and a table "Each limit and what it protects against".

- [ ] **Step 1: Write the failing tests:** `it("quotes the agent's measured cost, tokens and steps from the committed results")` reads the JSON and asserts the doc contains `$${(costUsd / calls).toFixed(4)}` per run, the mean input and output tokens per run rounded to the nearest 10, and `${meanStepsPerRun} steps`. `it("quotes per-run latency as latencyMs divided by attempts")` asserts the slowest and fastest per-run seconds (to one decimal) appear. `it("states the agent limits from config")` asserts the doc contains `AGENT.maxSteps`, `AGENT.maxRunTokens` (with a thousands separator), `AGENT.maxStepTokens`, `AGENT.deadlineMs / 1000` seconds, `AGENT_RATE.runProduction`, `AGENT_RATE.approve`.
- [ ] **Step 2: Run** and confirm failure.
- [ ] **Step 3: Write the section** covering: what a run costs and how long it takes (measured, with the date, model and "one small model, 19 runs" caveat); the up-front reservation (a run asks for `AGENT.maxSteps + 1` model calls from the shared pool before its first paid call, see `app/api/agent/route.ts`); the two protections around a run (the per-client rate limit and the concurrency gate); the 15 second step timeout and 60 second deadline; one table giving each limit, its number and the abuse or cost it prevents (steps, tokens per run, tokens per step, deadline, rate, gate, only-ids-from-a-lookup, signed drafts). State plainly that the per-step output maximum is not recorded in the results rows (only totals), so the 400 limit is unmeasured beyond the average of about 140 output tokens per step.
- [ ] **Step 4: Run** `npx jest tests/performance-docs app/docs/performance`. Expected: pass.
- [ ] **Step 5: Commit** `docs: add what an agent run costs, how long it takes and what each limit protects`.

### Task 4: The agent eval report

**Files:**

- Modify: `docs/EVAL.md`
- Test: `tests/agent-report-docs.test.ts` (create)

**Interfaces:**

- Consumes: `formatTable(rows: AgentRow[], model: string): string` from `evals/agent-results.ts`; the committed results files `...-final-pre-merge.json` (the report) and, for the history table, `...-after-date-guard.json`, `...-after-mobility-case.json`, `...-after-no-match-rule.json`.
- Produces: a section "The agent eval report" in `docs/EVAL.md`.

- [ ] **Step 1: Write the failing test:** `it("embeds the table the eval harness prints for the report run")` reads the report JSON, computes `formatTable(file.rows, file.model)` and asserts `docs/EVAL.md` contains that exact text inside a fenced block. `it("lists the pass count of each committed run in the history table")` asserts a line per committed agent results file with its `passed` out of `cases`.
- [ ] **Step 2: Run** `npx jest tests/agent-report-docs` and confirm failure.
- [ ] **Step 3: Write the section:** the embedded table (steps, tokens, dollars, latency, how it ended, pass per case, which is the "write down steps, cost and failures" exercise item); a history table of the four committed runs with what failed and what fixed it in plain words (no date given, a rider not on file counted as a mistake, the mobility case expecting the wrong kind of question); the honest limits (small model, one run each, tuned on these nine cases, `facts in a draft` is intermittent in the parse step). Link to the agent guide for how to read a failure.
- [ ] **Step 4: Run** `npx jest tests/agent-report-docs lib/markdown app/docs/eval`. Expected: pass.
- [ ] **Step 5: Commit** `docs: publish the agent eval report with the table the harness prints`.

### Task 5: README, migration step and firewall rules

**Files:**

- Modify: `README.md`, `docs/HISTORY-SETUP.md` (only if it holds the firewall steps)
- Test: `tests/agent-docs.test.ts`

**Interfaces:**

- Consumes: `db/migrations/2026-11-14-agent-approve.sql`; `AGENT_RATE` from `lib/config.ts`.

- [ ] **Step 1: Write the failing tests** in `tests/agent-docs.test.ts`: `it("README tells the owner to run the agent approve migration before using Approve")` asserts `README.md` contains `2026-11-14-agent-approve.sql` and the word "before". `it("README names a firewall rule for the agent routes with the limits from config")` asserts it contains `POST /api/agent` and the numbers `AGENT_RATE.runProduction` and `AGENT_RATE.approve`.
- [ ] **Step 2: Run** and confirm failure.
- [ ] **Step 3: Implement.** Add the migration to the existing migration list in the same style as the other two (run once in the Neon console, before saving a trip with Approve). Add a firewall rule for `POST /api/agent` (IP key, 60 s, limit `AGENT_RATE.runProduction`) and `POST /api/agent/approve` (limit `AGENT_RATE.approve`), action Log first, Deny later, in the same style as the parse rule. Add a README troubleshooting row: "Agent unavailable: `DRAFT_SIGNING_SECRET` is missing, too short or not linked to this project in Vercel, and the site needs a redeploy after it is added".
- [ ] **Step 4: Run** `npx jest tests/agent-docs lib/docs-examples`. Expected: pass.
- [ ] **Step 5: Commit** `docs: README migration step, agent firewall rules and the agent-unavailable fix`.

### Task 6: Agent requirements on the Requirements page

**Files:**

- Modify: `app/requirements/page.tsx` (and `lib/requirements-examples.ts` only if the page reads from it)
- Test: `app/requirements/page.test.tsx`

**Interfaces:**

- Consumes: the requirement IDs and text in the PRD tables "Tool calling (week 4)" (TC-1 to TC-10) and "Agent loop (week 5)" (AL-1 to AL-15).

- [ ] **Step 1: Write the failing test:** `it("lists the agent requirements TC-1 to TC-10 and AL-1 to AL-15, each once")` renders the page and asserts each ID appears exactly once, plus the existing axe test still passes.
- [ ] **Step 2: Run** `npx jest app/requirements` and confirm failure.
- [ ] **Step 3: Implement.** Read the page and follow its existing section pattern; add a section "The agent" with the 25 requirements in short plain wording (copy the IDs and meanings from the PRD, one line each).
- [ ] **Step 4: Run** `npx jest app/requirements lib/requirements-examples`. Expected: pass.
- [ ] **Step 5: Commit** `docs: add the agent requirements to the Requirements page`.

### Task 7: FAQ mistakes log, entries 41 to 44

**Files:**

- Modify: `docs/FAQ.md` (before "What these have in common")
- Test: `tests/agent-docs.test.ts`

**Interfaces:**

- Produces: four entries in the existing format (What happened, Caught by, Fix, Lesson), numbered 41 to 44, titled: "41. The agent assumed today's date when the note had none", "42. A search that found no rider counted as a mistake, and the error invited more searching", "43. The agent button was on the page while the agent was switched off", "44. One run of a small model is a sample, not a verdict".

- [ ] **Step 1: Write the failing test:** `it("the FAQ mistakes log numbers 1 to 44 with no gap, and the four agent entries exist")` extracts every `### N.` heading and asserts the numbers run 1 to 44 in order and the four titles are present.
- [ ] **Step 2: Run** and confirm failure.
- [ ] **Step 3: Write the entries** from these facts: (41) first live eval, case "no date" failed 3 of 3, the model assumed 2026-11-02 from its own prompt, caught by the live eval, fixed by a code guard in `checkWhen` (a prompt line can be ignored, a rule in code cannot); (42) "unknown rider" failed after three respelled searches hit the three-mistakes stop, caught by the live eval, fixed by marking a no-match as expected so it does not count and by changing the error text to "Do not search again. Call ask_dispatcher..."; (43) the live site showed a button that returned "Agent unavailable" because `DRAFT_SIGNING_SECRET` was a shared Vercel variable linked to no project and the site had not been redeployed, caught by a live request, fixed by a page notice that asks `GET /api/agent` first and by linking the variable and redeploying; (44) "facts in a draft" and "unknown rider" passed once and failed later with no code change, so a single run proves little. Lessons in italics, as the file does.
- [ ] **Step 4: Run** `npx jest tests/agent-docs lib/docs-examples tests/privacy-claims`. Expected: pass.
- [ ] **Step 5: Commit** `docs: add four agent mistakes to the FAQ log`.

### Task 8: Status table, cross-links and full check

**Files:**

- Modify: `docs/AGENT.md`
- Test: `tests/agent-docs.test.ts`

- [ ] **Step 1: Write the failing test:** `it("the status table says the performance docs and eval report are built")` asserts the table no longer contains "Not built yet" on the performance row and that `docs/AGENT.md` links to the Performance page and the eval report.
- [ ] **Step 2: Run** and confirm failure.
- [ ] **Step 3: Implement.** Change that row to "Built and tested (docs and a test that pins their numbers)". Add links from "Evals: testing an agent" to the eval report and from "The limits" to the Performance page.
- [ ] **Step 4: Run** `npm run check` and `npx playwright test e2e/agent.spec.ts` (the docs pages build in `next build` inside the check; confirm `/docs/performance` appears in the route list with `npx next build`). Expected: all pass.
- [ ] **Step 5: Commit** `docs: mark the performance docs and eval report built`.
