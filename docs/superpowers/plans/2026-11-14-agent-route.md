# RideNote Agent Route, Approve and Page Implementation Plan (Plan C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the tested agent loop to the outside world. A dispatcher types a note and presses "Plan trip (agent)". The server streams each step to the page as it happens. When the agent proposes a trip, the page shows it with badges and an Approve button. When the agent asks a question, the page shows the options as buttons, and the choice resumes the same run. Approve saves the trip to History through a signed draft, and nothing else in the run writes data.

**Architecture:** Three pieces, each small. (1) `POST /api/agent` runs `runAgent` and streams one NDJSON line per event. (2) `POST /api/agent/approve` checks a signed draft and inserts it, the only write. (3) A client component on the Parse page draws the timeline from the stream. The loop, tools, signing and merge code already exist and are unit-tested (PRs #21 to #27). This plan wires them together and adds nothing to the loop's limits.

**Tech Stack:** Next.js 16 App Router route handlers (Node runtime, Fluid Compute), TypeScript, Zod, the existing `lib/agent/*` modules, `lib/history` for the insert, Jest, Playwright (stubbed model), the eval harness in `evals/`.

**Spec:** `docs/superpowers/specs/2026-10-29-dispatch-agent-design.md` ("A run, end to end", "Approve and resume", "Page", "Table changes", "Testing"). Scope is set by `docs/superpowers/specs/2026-11-13-agent-tool-calling-loop-prd.md` (AL-10, AL-11, AL-14), with its ruling 9 (full step records only in invented data).

**Branch:** `feature/agent-route-plan`, cut from `main` at c4ec382. This plan document is the only change in this branch's first commit. The build tasks below land on follow-up branches, one PR each, after the plan is reviewed.

**Not in this plan:** the comparison panel, the eval report page, performance docs (plan D), and any change to the loop limits in `lib/config.ts`.

## Global Constraints

- Every limit comes from `AGENT` and `UPSTREAM` in `lib/config.ts`. No new magic numbers. Current values: 6 steps, 20,000 run tokens, 400 output tokens per step, 60 s per run, 3 same-kind mistakes in a row.
- Per-step timeout: 15 s, with one retry (ruling from the design's "Approve and resume" section). The retry counts against the 60 s run deadline, not a fresh one.
- Models: the agent runs on `claude-haiku-5-5`. Forced tool choice is refused on Sonnet 5.5, Opus 5.5 and Fable 5, and the model guard already enforces this.
- The model reads the note, so the note never goes into a log, a step record or an error message. Step records hold tool names, inputs the model wrote, results and tokens. Scrub (`lib/scrub.ts`) before any save.
- Signed drafts and resume tokens expire after 15 minutes. The signing secret must be at least 32 characters (`AGENT.secretMinLength`). `DRAFT_SIGNING_SECRET` is required in production; in development a fixed secret is used and History is written to memory only.
- Approve never calls the model. A resume reuses the signed, already-parsed trip and does not parse the note again.
- Rate limits: agent 2 a minute in production (5 elsewhere); Approve 10 a minute. A resume counts as a new run.
- No new dependencies. `npm run check` passes before every commit (coverage floor 98/95/98/98). Test titles are literal strings. No Claude or Anthropic attribution in commits or PR text (the user's global rule).
- Evals, unit tests, browser tests and PR work run on `claude-haiku-5-5`.

## Review Focus

1. A tampered or expired resume token, or a draft whose signature does not match, is refused before any model call and before any insert.
2. Approve inserts with `ON CONFLICT (draft_id) DO NOTHING` and source `agent`, so a replayed Approve writes nothing new.
3. The stream never sends the note or model free text. Each event has only the step number, tool names, results, tokens and times.
4. A run that ends `failed` (deadline, budget, upstream) shows what it learned and no Approve button.
5. The page's live region announces each step once, not each character, and the Approve button appears only when the status is `proposed`.
6. Production with no `DRAFT_SIGNING_SECRET` returns 503 "Agent unavailable" and does not fall back to a fixed secret.

---

## File structure

| File                                      | Responsibility                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `app/api/agent/route.ts` (create)         | `POST`: front checks, rate limit, budget reservation, runs the loop, streams NDJSON events  |
| `app/api/agent/approve/route.ts` (create) | `POST`: verifies a signed draft, scrubs, inserts with `DO NOTHING`                          |
| `lib/agent/stream.ts` (create)            | Turns a `RunResult` into the ordered NDJSON events, pure and unit-tested                    |
| `lib/agent/resume.ts` (create)            | Verifies a resume token, checks the chosen option belongs to it, builds the resumed context |
| `lib/agent/budget.ts` (create)            | Reserves `maxSteps + 1` budget units per run before the first call                          |
| `lib/agent/timeout.ts` (create)           | Per-step 15 s timeout with one retry, sharing the run deadline                              |
| `app/parse/agent-panel.tsx` (create)      | Client component: the "Plan trip (agent)" button, timeline, badges, options, Approve        |
| `app/parse/page.tsx` (modify)             | Mounts the panel next to the existing workflow                                              |
| `db/migrations/*agent*.sql` (create)      | Adds the `agent` value to the source column, if the table uses a check (see Task 6)         |
| `evals/agent-cases.ts` (modify)           | Adds live case 10, "resume with a choice"                                                   |
| `evals/agent-run.ts` (modify)             | Runs the resume step for case 10                                                            |
| `tests/e2e/agent.spec.ts` (create)        | Browser tests with the stubbed multi-turn model                                             |
| `README.md` (modify)                      | The new variable `DRAFT_SIGNING_SECRET`, the route, the firewall note                       |

---

### Task 1: Stream events from a finished run

**Files:** Create `lib/agent/stream.ts`, `lib/agent/stream.test.ts`.

**Interfaces:**

- Produces: `toEvents(result: RunResult): StreamEvent[]`, where `StreamEvent` is one of `run_started`, `parsed`, `step`, `ended`. A `step` event carries only `step`, `tools` (names), `results` (content and is_error per call), `tokens` and `ms`. `ended` carries `status`, `reason` (failed only), `usage`, and for `proposed` the signed `draft` string; for `needs_info` the `question`, `options` and `resume` string.
- Consumes: `RunResult`, `StepRecord` from `lib/agent/types.ts`.

- [ ] **Step 1: Write failing tests.** One test per event kind; a test that the serialized output never contains the note (pass a note with a distinctive word and check it is absent); a test that a `failed` run ends with `reason` and no `draft`.
- [ ] **Step 2: Run** `npx jest lib/agent/stream.test.ts`; expect failure.
- [ ] **Step 3: Implement** `toEvents` as a pure function. Keep the order: `run_started`, `parsed`, one `step` per `StepRecord`, then `ended`.
- [ ] **Step 4: Run** the test again; expect pass.

### Task 2: Resume token verification

**Files:** Create `lib/agent/resume.ts`, `lib/agent/resume.test.ts`. Modify `lib/agent/sign.ts` only if a helper is missing.

**Interfaces:**

- Produces: `openResume(token: string, choice: number, opts: { secret: string; now: Date }): { ok: true; parsed: Trip; riders: ...; ctx: ... } | { ok: false; reason: "tampered" | "expired" | "bad_choice" }`.
- Consumes: the resume token that `ask_dispatcher` signs (`RunEnd` with `status: "needs_info"`), `verifySigned` from `lib/agent/sign.ts`.

- [ ] **Step 1: Failing tests:** a valid token and choice opens; a changed byte is `tampered`; a token older than 15 minutes is `expired`; a choice index outside the signed options is `bad_choice`; a choice whose option has a `rider_id` that is not in the signed options is `bad_choice`.
- [ ] **Step 2: Run**; expect failure.
- [ ] **Step 3: Implement** using the same HMAC and expiry code that drafts use. The choice is an index into the signed options, never free text.
- [ ] **Step 4: Run**; expect pass.

### Task 3: Per-step timeout with one retry

**Files:** Create `lib/agent/timeout.ts`, `lib/agent/timeout.test.ts`. Modify `lib/agent/loop.ts` to use it for each model call.

**Interfaces:**

- Produces: `callWithStepTimeout(call: (signal: AbortSignal) => Promise<ModelReply>, opts: { stepMs: 15_000; runSignal: AbortSignal; retries: 1 }): Promise<ModelReply>`. A timeout or a retryable upstream error (429, 5xx, network) retries once. The run's deadline signal aborts both attempts.

- [ ] **Step 1: Failing tests** with fake timers: a call that never resolves times out at 15 s and retries; a second timeout ends the step with `deadline` or `upstream`; a non-retryable error (400) does not retry; the run signal aborts immediately.
- [ ] **Step 2: Run**; expect failure.
- [ ] **Step 3: Implement** and wire into `runAgent` so a timeout ends with a named reason, never an uncaught throw.
- [ ] **Step 4: Run** `npx jest lib/agent`; expect pass, and the existing loop tests still pass unchanged.

### Task 4: Budget reservation

**Files:** Create `lib/agent/budget.ts`, `lib/agent/budget.test.ts`.

**Interfaces:**

- Produces: `reserve(units: number): Promise<{ ok: true; release(): void } | { ok: false }>` against an in-process gate for development and the existing agent-gate store for production. The route reserves `AGENT.maxSteps + 1` units (the extra one is the parse step) before the first model call, and refuses with 429 when the daily or per-minute cap is full.

- [ ] **Step 1: Failing tests:** reserving within the cap succeeds; a reservation over the cap is refused with no partial hold; `release` returns the units; two concurrent reservations cannot both pass the last unit.
- [ ] **Step 2: Run**; expect failure.
- [ ] **Step 3: Implement** the check-and-hold as one synchronous step so concurrency cannot double-spend.
- [ ] **Step 4: Run**; expect pass.

### Task 5: The agent route (`POST /api/agent`)

**Files:** Create `app/api/agent/route.ts`, `app/api/agent/route.test.ts`.

**Interfaces:**

- Accepts JSON `{ note: string, timeZone: string, resume?: { token: string; choice: number } }`. Validated with a strict Zod schema; anything else is 400.
- Order of work: size limit, rate limit (2 a minute in production, 5 elsewhere), signing secret present in production (else 503 "Agent unavailable"), budget reservation (Task 4), then `runAgent`. A resume goes through `openResume` (Task 2) and skips the parse step.
- Response: `200` with `Content-Type: application/x-ndjson`, one `toEvents` line per event (Task 1), written as the run progresses, not at the end. Always ends with `ended`.
- Errors before the stream starts return JSON with a named code. Errors during the stream send an `ended` event with `status: "failed"`.

- [ ] **Step 1: Failing tests** (route handler called directly with a `Request`, model injected through a test seam): a valid note streams `run_started`, `parsed`, `step` lines and `ended`; an empty note is 400; an oversize note is 413; a production request without the secret is 503; a rate-limited request is 429; a resume with a tampered token is 400 and makes no model call; the response body never contains the note.
- [ ] **Step 2: Run**; expect failure.
- [ ] **Step 3: Implement.** Reuse `createAnthropicModel` and `agentSystemPrompt`. Put the model seam behind a single function so tests replace it.
- [ ] **Step 4: Run**; expect pass.

### Task 6: Approve (`POST /api/agent/approve`) and the insert

**Files:** Create `app/api/agent/approve/route.ts`, `app/api/agent/approve/route.test.ts`. Create a migration only if the history table's `source` column has a check that does not yet allow `agent`; otherwise no migration.

**Interfaces:**

- Accepts JSON `{ draft: string }`. Checks, in order: rate limit (10 a minute), size, signature, expiry (15 minutes), schema (`TripSchema`). Then scrubs and inserts with `source = 'agent'` and `ON CONFLICT (draft_id) DO NOTHING`.
- Returns `{ status: "saved" | "already_saved" }`. Never calls the model.

- [ ] **Step 1: Failing tests:** a valid draft saves once and returns `saved`; the same draft again returns `already_saved` and writes nothing new; a changed byte is 400 `tampered`; an expired draft is 400 `expired`; an invalid trip is 400; production without the secret is 503; the insert uses `DO NOTHING` (assert on the SQL text).
- [ ] **Step 2: Run**; expect failure.
- [ ] **Step 3: Implement** using `lib/history` for the insert, the same way Parse's save does today.
- [ ] **Step 4: Check the migration question** by reading the history table definition. Record the answer in the PR description.
- [ ] **Step 5: Run**; expect pass.

### Task 7: The page (`agent-panel.tsx`)

**Files:** Create `app/parse/agent-panel.tsx`, `app/parse/agent-panel.test.tsx`. Modify `app/parse/page.tsx`.

**Interfaces:**

- A client component with a "Plan trip (agent)" button, a timeline list with `aria-live="polite"`, badges ("from note", "from rider file", "conflict"), a run summary (steps, tokens, time, how it ended), options as buttons when `needs_info`, and an Approve button only when the status is `proposed`.
- Reads the NDJSON stream with `fetch` and a reader, one line at a time, and ignores a malformed line with a visible message instead of crashing.

- [ ] **Step 1: Failing component tests** (Jest with Testing Library): steps appear in order; Approve is absent while the run is in progress and present once `proposed`; `needs_info` shows option buttons and a click posts the resume; a `failed` run shows the reason and no Approve; a malformed line shows a message.
- [ ] **Step 2: Run**; expect failure.
- [ ] **Step 3: Implement.** Keep the layout at phone width with a 16 px gutter and no horizontal scroll.
- [ ] **Step 4: Run**; expect pass.

### Task 8: Browser tests with a stubbed multi-turn model

**Files:** Create `tests/e2e/agent.spec.ts`. Modify the `E2E:` stub used by the existing Playwright setup to accept a scripted sequence of tool calls.

- [ ] **Step 1: Write the Playwright tests:** a note that ends `proposed` shows the timeline, the badges and Approve; Approve saves once and a second click says `already_saved`; a note that ends `needs_info` shows options, a choice resumes and ends `proposed`; a partial run that hits the deadline shows what it learned and no Approve.
- [ ] **Step 2: Run** `npm run test:e2e` (on port 3100, stubbed model); expect the new tests to fail first, then pass after the build tasks.

### Task 9: Live eval case 10 (resume with a choice)

**Files:** Modify `evals/agent-cases.ts`, `evals/agent-run.ts`, `evals/agent-score.ts`, `tests/agent-docs.test.ts` (case count and names).

- [ ] **Step 1:** Add case 10, a note with a real ambiguity (two riders share a name). The first run must end `needs_info`; the harness then resumes with option 0 and the case passes only if the resumed run ends `proposed` for the chosen rider, with no second parse call.
- [ ] **Step 2:** Mark it critical only after it passes three runs on Haiku. Until then it is non-critical and retried.
- [ ] **Step 3:** Update `docs/AGENT.md` and the docs test: ten cases, the new count of critical cases.

### Task 10: Config, README and docs

**Files:** Modify `README.md`, `docs/AGENT.md`, `lib/config.ts` only to add the variable name if the config module lists them.

- [ ] **Step 1:** README: the new `DRAFT_SIGNING_SECRET` (production-only, at least 32 characters, never shared with the client), the route, and the firewall rule for `/api/agent`.
- [ ] **Step 2:** `docs/AGENT.md`: replace "not built yet" with what now works, keep the honest caveat about tuned cases.
- [ ] **Step 3:** Run the docs test; expect the pinned sentences to need an update, and update them in the same commit.

---

## Verification (before the PR is marked ready)

1. `npm run check` (lint, types, format, unit tests, coverage floor). Run on `claude-haiku-5-5` as the user asked.
2. `npm run test:e2e` on the stubbed model.
3. `npm run build`.
4. Live evals, pinned to Haiku: `MODEL=claude-haiku-5-5 AGENT_MODEL=claude-haiku-5-5 EVAL_MAX_USD=0.5 bash scripts/with-keychain.sh npx jest --config jest.eval.config.mjs evals/agent.eval` and `evals/parser.eval`. Record cost and results in `evals/agent-results/`.
5. Note any failing case honestly in the PR. Do not retune cases to pass; a new held-out set is still unwritten.

## Open decisions for the user

- Whether to build Tasks 1 to 10 now, or only keep this plan. Building them is a large change, so it should be a decision, not a default.
- Whether each build PR gets a review before merge.
- The four unidentified results files in `evals/agent-results/` (untracked) stay uncommitted until their origin is known.
