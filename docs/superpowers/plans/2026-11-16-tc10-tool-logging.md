# TC-10 tool-call logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meet requirement TC-10: every tool call prints one `[tool]` trace line in the eval script and writes one log line in the route, with no inputs and nothing personal.

**Architecture:** One small module, `lib/agent/log.ts`, turns a step record into one line per tool call. `lib/agent/service.ts` writes those lines (JSON, like the parse route's `llm_call` line) from the loop's existing `onStep` hook, so `app/api/agent/route.ts` is not touched (two open PRs edit it). `evals/agent-run.ts` prints the `[tool]` trace through an optional callback that `evals/agent.eval.ts` supplies.

**Tech Stack:** TypeScript, Jest.

**Spec:** `docs/superpowers/specs/2026-11-13-agent-tool-calling-loop-prd.md` requirement TC-10 (line 119), and the design `docs/superpowers/specs/2026-10-29-dispatch-agent-design.md` finding 16 ("per-step log lines"). The logging convention is in `CLAUDE.md` ("Per-call usage is logged as single-line JSON ... never the note or anything parsed from it").

## Global Constraints

- Work only in the worktree `/Users/markguerrero/Solutions/ridenote/.claude/worktrees/tc10` (branch `feat/tc10-tool-logging`, stacked on `docs/agent-docs`). Never touch `/Users/markguerrero/Solutions/ridenote` itself.
- A log or trace line holds only: event name, run id, step number, a tool name from the known list, and ok or error. Never a tool input, a tool result, a note, a rider name or id, an error message, or a draft.
- The tool name is chosen by the model, so only names in `TOOL_DEFS` (`lib/agent/tools.ts`) are written; any other name is written as `unknown`.
- Logging must never change or break a run: a throwing log sink must not stop the run (the loop already catches `onStep` throws; keep it so).
- Do not change `app/api/agent/route.ts`, `lib/agent/prompt.ts` or `lib/config.ts`.
- No live API calls and no live evals. Every commit passes the pre-commit `npm run check`. Commit with explicit paths. No Co-Authored-By or any Claude/Anthropic attribution line. No personal email anywhere.
- Docs in plain English for a beginner, no em dashes. Test titles are literal strings.

## Review Focus

- A model-chosen tool name (for example "find_rider; DROP" or a 5,000 character string) reaching the log: it must become `unknown`.
- A tool result or error message (which can hold a rider name) reaching a log or trace line: it must never.
- A step with two tool calls, one that errored, and one unknown tool: one line each, with the right ok value.
- A log sink that throws: the run still finishes with its normal ending.
- A step with zero tool calls (the model answered in text): zero lines, and no crash.

---

### Task 1: The log line, the route wiring and the script trace

**Files:**

- Create: `lib/agent/log.ts`, `lib/agent/log.test.ts`
- Modify: `lib/agent/service.ts`, `lib/agent/service.test.ts`, `evals/agent-run.ts`, `evals/agent-run.test.ts`, `evals/agent.eval.ts`

**Interfaces:**

- Produces in `lib/agent/log.ts`:
  - `toolLogLines(record: StepRecord, runId: string, at: Date): string[]` returns one single-line JSON string per call in `record.calls`: `{"event":"agent_tool","runId":...,"at":ISO,"step":N,"tool":name|"unknown","ok":boolean}`.
  - `toolTraceLines(record: StepRecord, label: string): string[]` returns one line per call: `[tool] <label> step <N> <tool|unknown> <ok|error>`.
  - Both use one shared helper that maps a call name to a known name or `unknown`.
- Produces in `lib/agent/service.ts`: `ServiceDeps` gains optional `log?: (line: string) => void` (default `console.info`) and `now?: () => Date` (default `() => new Date()`); the loop's `onStep` writes `toolLogLines(record, ctx.runId, now())` to `log` after it emits the step event.
- Produces in `evals/agent-run.ts`: `CaseDeps` gains optional `trace?: (line: string) => void`; `runAgentCase` passes an `onStep` to `runAgent` that sends each `toolTraceLines(record, c.name)` line to `trace`. `evals/agent.eval.ts` passes `trace: console.log`.

- [ ] **Step 1: Write the failing tests** in `lib/agent/log.test.ts`: (a) one record with calls `find_rider` ok, `check_vehicle_availability` error, and `rm -rf` ok yields three lines whose parsed `tool` values are `find_rider`, `check_vehicle_availability`, `unknown` and `ok` values true, false, true; (b) a 5,000 character tool name yields `unknown` and the line is short (under 300 characters); (c) a call whose `input` holds `{"name":"Maria Santos"}` and whose `content` holds `No rider matches "Maria Santos"` produces lines that contain neither "Maria" nor "Santos" nor the word "matches"; (d) a record with no calls yields `[]`; (e) `toolTraceLines` yields `[tool] two Marias step 2 find_rider ok` style lines with the same unknown mapping; (f) every log line parses as JSON with exactly the keys event, runId, at, step, tool, ok. In `lib/agent/service.test.ts` add: a run with a scripted model that calls `find_rider` then `ask_dispatcher` writes exactly two `agent_tool` lines to an injected `log`, in order, with the run id and a fixed `now`; a `log` that throws still lets the run end `needs_info`. In `evals/agent-run.test.ts` add: with a `trace` callback, a scripted case prints one `[tool]` line per call, and without `trace` nothing is printed.
- [ ] **Step 2: Run** `npx jest lib/agent/log lib/agent/service evals/agent-run` and confirm the new tests fail.
- [ ] **Step 3: Implement** the interfaces above. Use the known-name list from `TOOL_DEFS` (import it, do not retype the names). Wire `service.ts` in `finish` next to the existing `onStep` that emits the step event; default the sink to `console.info` so the route (which does not pass `log`) logs to the server output like the parse route does. Wire `evals/agent-run.ts` and `evals/agent.eval.ts` as described.
- [ ] **Step 4: Run** `npx jest lib/agent evals app/api/agent` and confirm all pass with pristine output (no stray log lines in test output: tests inject `log` and `trace`; where the default sink would print, spy on `console.info` and silence it).
- [ ] **Step 5: Commit** `feat(agent): one log line per tool call in the route and one trace line in the eval script`.

### Task 2: Docs and the status table

**Files:**

- Modify: `docs/AGENT.md`, `docs/FAQ.md` and `app/docs/page.tsx` (only where they describe the usage log line), `README.md` (only if it describes logging)
- Test: `tests/agent-docs.test.ts`, `tests/privacy-claims.test.ts`

**Interfaces:**

- Consumes: Task 1's event name `agent_tool` and its fields (event, runId, at, step, tool, ok).

- [ ] **Step 1: Write the failing tests.** In `tests/agent-docs.test.ts`: `it("the status table says TC-10 per-tool-call logging is built")` asserts the TC-10 row no longer says "Not built yet" and mentions `agent_tool`; and `it("the guide says what an agent log line holds and what it never holds")` asserts `docs/AGENT.md` contains `agent_tool` and states that no input, result, note or name is logged. In `tests/privacy-claims.test.ts` extend the logging test so `docs/FAQ.md` and `app/docs/page.tsx` mention the agent log line too (the words `agent_tool` or "one line per tool call").
- [ ] **Step 2: Run** `npx jest tests/agent-docs tests/privacy-claims` and confirm failure.
- [ ] **Step 3: Update the docs.** In `docs/AGENT.md` flip the TC-10 row to "Built and tested" with a one-line description, and add a short subsection under "Staying safe" (or beside "What the step records hold") describing the log line: one JSON line per tool call, the fields, that the tool name is limited to the four known tools, that nothing from the note, the rider file or the model's text is logged, and that the eval script prints a `[tool]` line per call. In the FAQ and the docs page, add one sentence next to the usage log line sentence saying the agent writes one line per tool call with the same privacy rule. Do not claim anything about the live site.
- [ ] **Step 4: Run** `npm run check` and `npx jest tests/agent-docs tests/privacy-claims lib/docs-examples`. Expected: all pass.
- [ ] **Step 5: Commit** `docs: say what the agent tool log line holds and mark TC-10 built`.
