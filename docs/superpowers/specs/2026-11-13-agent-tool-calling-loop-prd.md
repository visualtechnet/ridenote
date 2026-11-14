# RideNote agent: tool calling and the agent loop (PRD)

Date: 2026-11-13. Status: **draft for Mark's review. Research only: nothing here is built.**

This PRD covers the work Mark calls "RideNote Agent, Weeks 4 and 5": tool calling (week 4) and an
agent loop (week 5). It does not replace the design in
`docs/superpowers/specs/2026-10-29-dispatch-agent-design.md`. That design is still the technical
source of truth. This document says what must be delivered, what is already done, what current
vendor guidance says, and where the design should change before a build plan is written.

## Sources and their limits

| Source                                                                                                                        | Used for                                    | Limit                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| AI Lesson 2, "Agents & Tool Calling" (PDF, 2026-10-24)                                                                        | The exercise items and "Check yourself"     | Read in full                                                       |
| `2026-10-29-dispatch-agent-design.md`                                                                                         | Scope, tools, limits, phasing               | Written against SDK 1.3.0; some facts need re-checking (see below) |
| This repository at `6407035` (main, 2026-11-03)                                                                               | What is already built                       | Read, built, and tested on 2026-11-13                              |
| Claude Platform docs and Anthropic engineering posts (links at end)                                                           | Current practice                            | Fetched 2026-11-13                                                 |
| OWASP and OpenAI agent guidance                                                                                               | Cross-vendor practice                       | Secondary summaries only; the primary PDFs were not read           |
| Todoist task "RideNote agent: Weeks 4–5 (tool calling + agent loop)" and its linked "8-Week AI Learning & LinkedIn Post Plan" | The week split, the checklist and the dates | Read on 2026-11-13 (task, 7 sub-tasks, weeks 4 and 5 of the plan)  |

The week split below is taken from the Todoist task and the plan it links to. The first draft of
this PRD assumed a different split; "Scope by week" records what changed.

## Problem

RideNote today is a workflow: one model call, then validation. It cannot use anything the note does
not say. "Maria, usual place, 9 tomorrow" comes back with a missing pickup, although a dispatcher
would look Maria up. Mark also wants to learn agents by building one, and to show that he can build
one safely and measure it.

## Goal

A dispatcher can press **Plan trip (agent)** on the same note. The agent looks up the rider, checks
a vehicle, and ends in one of two ways: a proposed trip that a person approves, or a question for the
dispatcher. Every run reports its steps, tokens, time and how it ended.

## Users

- **Dispatcher (demo user):** wants a filled-in trip without retyping, and wants to be asked, not
  guessed for, when the note is ambiguous.
- **Mark (builder and learner):** wants every Lesson 2 exercise item done and understood.
- **A reviewer or hiring manager:** wants to see the guardrails, the evals and the cost numbers.

## Where the project stands (2026-11-13)

| Design phase                                                  | State                                             |
| ------------------------------------------------------------- | ------------------------------------------------- |
| 1. `scripts/agent.ts`: raw loop, fixtures, four tools, trace  | **Not started**                                   |
| 2. Dates for Parse, injectable clock, migration               | **Done**, merged as PR #18                        |
| 3. Agent route, reservation, gate, stream, Approve, page      | Not started                                       |
| 4. Live agent evals, Performance and Agent docs, `toolRunner` | Not started (Lesson 3 parser evals exist, PR #19) |

Baseline on a fresh clone today: `npm run check` passes (940 tests, coverage 99.94% lines),
Playwright passes (169 tests), `npm run build` passes, and a live parse works in the dev server.

## Scope by week (from the Todoist task)

The task reads: "Finish the RideNote agent loop to cover AI Learning Weeks 4 and 5." It has seven
sub-tasks. The linked plan says requirements and unit tests come with the code, not after it.

**Week 4, tool calling in RideNote. Session: Sunday Nov 15, 2026.**

| Sub-task                                                                                                    | Due    | Covered by                                                   |
| ----------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------ |
| Re-read the agent design spec and Anthropic's tool use docs; confirm or change the defaults left for review | Nov 13 | "The design's defaults" and "Where the design should change" |
| Write the requirements doc: each tool's purpose, inputs, outputs, failure cases, acceptance criteria        | Nov 13 | "Tool specifications" in this PRD                            |
| Implement the agent tools with Zod input validation                                                         | Nov 15 | TC-1 to TC-10                                                |
| Unit tests for every tool, including failed calls                                                           | Nov 15 | The acceptance criteria under "Tool specifications"          |

**Week 5, the RideNote agent loop. Session: Sunday Nov 22, 2026.**

| Sub-task                                                                                 | Due    | Covered by          |
| ---------------------------------------------------------------------------------------- | ------ | ------------------- |
| Read "Building effective agents", then add the loop requirements to the requirements doc | Nov 22 | AL-1 to AL-15       |
| Build the agent loop with a step limit, plus unit tests for the loop and stop rules      | Nov 22 | AL-1 to AL-4        |
| Add agent evals alongside the parser evals; log every step for replay                    | Nov 22 | AL-11, AL-12, AL-15 |
| Update docs: README, Docs > Agents, security and performance notes                       | Nov 22 | AL-14               |

Each week also has a LinkedIn post due within 2 days of the session. Posts are outside this PRD.

**What the task does not list.** The task and the plan name the tools, the loop, its tests, the
evals, the step log and the docs. They do not name the agent route, the page, Approve or resume
(design phase 3). Lesson 2's last exercise item and the design both include them. **Mark decided on
2026-11-13 to include them in week 5**, so week 5 covers AL-1 to AL-15.

Order of work in week 5, so the task's own list is safe if time runs short:

1. The loop as a pure function with a fake model, and its unit tests (AL-1 to AL-4).
2. The step log and replay (AL-15), then the live agent evals (AL-11, AL-12).
3. The route: front checks, reservation, gate, deadline, abort, stream (AL-5 to AL-8).
4. Approve and the page (AL-9, AL-10).
5. Docs (AL-14).

The design's cut line applies to steps 3 and 4: ship without resume after a question and without
the workflow-versus-agent panel, and add both straight after.

**What changed from the first draft.** The first draft put a throwaway script in week 4 and the
whole product (route, page, Approve, evals) in week 5. The task puts tested tool modules in week 4
and the loop, evals, step log and docs in week 5.

## Requirements

Each requirement has an ID so tests and the Requirements page can cite it.

### Tool calling (week 4)

| ID    | Requirement                                                                                                           | Lesson item             |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| TC-1  | Each tool has a name, a docstring-style description (what, when, returns, when not) and a JSON schema.                | Designing good tools    |
| TC-2  | Every tool sets `strict: true`. Its schema has `additionalProperties: false` and lists every property as required.    | Designing good tools    |
| TC-3  | Tool inputs are validated again in code with Zod before the tool runs.                                                | Safety                  |
| TC-4  | A tool never throws. A failure is a `tool_result` with `is_error: true` and a message that says what to try next.     | Exercise 4              |
| TC-5  | `find_rider` returns at most 3 matches with only the fields the task needs.                                           | "Return only what's..." |
| TC-6  | Two riders match "Maria": the agent asks, and never proposes.                                                         | Exercise 3              |
| TC-7  | `propose_trip` takes a `rider_id`, never retyped facts. Code fills in name, address and mobility.                     | Poka-yoke               |
| TC-8  | `propose_trip` writes nothing. It returns a signed draft and a `draft_id`.                                            | Exercise 2              |
| TC-9  | A planted instruction in a rider's notes, or in the dispatcher's note, changes no tool call and no draft.             | Exercise 5              |
| TC-10 | Every tool call prints one `[tool]` trace line in the script, and one log line in the route (no inputs, no personal). | Exercise 1              |

### Agent loop (week 5)

| ID    | Requirement                                                                                                                                          | Lesson item      |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| AL-1  | The loop appends the model's full `content` and then one user message that answers every `tool_use` block.                                           | Core concepts    |
| AL-2  | A run ends only through an ending tool or a named limit. Loose text is never shown as an answer.                                                     | Check yourself 3 |
| AL-3  | Limits: 6 steps, 20,000 tokens per run, 400 output tokens per step, 60 s per run. All in `lib/config.ts`.                                            | Safety           |
| AL-4  | Every `stop_reason` is handled by name: `tool_use`, `end_turn`, `max_tokens`, `refusal`, and anything unknown.                                       | Design gap 1     |
| AL-5  | The run's budget is reserved before the first paid call, so a run is never cut off half-way for budget.                                              | Design           |
| AL-6  | Agent runs use their own concurrency gate and cannot slow Parse.                                                                                     | Design           |
| AL-7  | The loop stops calling the model when the client disconnects.                                                                                        | Design           |
| AL-8  | Every stream ends with an `ended` event carrying `status`, `reason` and usage. A stream without one is shown as failed.                              | Design           |
| AL-9  | Only a person's Approve click saves a trip. Approve verifies the signature, expiry and schema, and a replay does nothing.                            | Exercise 6       |
| AL-10 | The page shows each step as it happens, in an `aria-live="polite"` list.                                                                             | Exercise 6       |
| AL-11 | Each run reports steps, input, output and cached tokens, latency and how it ended.                                                                   | "Write down"     |
| AL-12 | Live agent evals grade the path (tools, order, safety). The five critical cases must pass 3 runs out of 3.                                           | Lesson 3         |
| AL-13 | Nothing regresses: `npm run check`, the browser tests and the parser eval floor (90%, criticals 100%) stay green.                                    | Design           |
| AL-14 | `docs/AGENT.md` answers the six "Check yourself" questions, and the eval report records steps, cost and failures per case.                           | Check yourself   |
| AL-15 | Every step of a run is recorded so the run can be replayed: the model's tool call, the tool result, tokens and time. Records hold fixture data only. | Todoist, week 5  |

### Tool specifications

These are the per-tool requirements the week 4 sub-task asks for. Behavior comes from the design;
the acceptance criteria are the unit tests to write. Rules that hold for all four tools are TC-1 to
TC-4.

**`find_rider`**

- **Purpose:** look up a rider before any fact about them is used.
- **Inputs:** `name` (string, a full or partial first or last name).
- **Outputs:** at most 3 matches, each with `id`, `name`, `home`, `mobility_on_file` and `notes`.
  `notes` is capped at 200 characters and labeled as data.
- **Failure cases:** no match returns `is_error` "No rider matches …". An empty or over-long name
  fails Zod validation and returns `is_error`.
- **Acceptance criteria:**
  - "maria" returns both Marias; "MARÍA" returns the same two (case and accents ignored).
  - A last name alone finds its rider.
  - A name with no match returns `is_error` and does not throw.
  - A search that matches more than 3 riders returns 3.
  - A 500-character note in the fixture comes back as 200 characters.
  - The result holds only the five listed fields.

**`check_vehicle_availability`**

- **Purpose:** say whether a vehicle of the right class is free for the trip.
- **Inputs:** `date` (ISO date), `time` (24-hour time), `rider_id`.
- **Outputs:** `available` (true or false) and the vehicle class. Code picks the class from the
  trip's mobility; the model never names it.
- **Failure cases:** unknown `rider_id`; mobility that is "other" or not stated (`is_error` telling
  the agent to ask); the one documented fixture date returns `is_error` "Vehicle service
  unavailable"; a date outside today to today + 60 days (the design sets this window
  for dates in general; applying it in this tool is this PRD's addition).
- **Acceptance criteria:**
  - Wheelchair and scooter map to a wheelchair van, stretcher to a stretcher van, and walker, cane,
    crutches and ambulatory to a sedan.
  - The same input always gives the same answer.
  - The fixture date returns `is_error` and does not throw.
  - An unknown `rider_id` returns `is_error`.
  - Unstated mobility returns `is_error` that says to ask the dispatcher.

**`propose_trip`** (ends the run)

- **Purpose:** produce a draft trip for a person to approve.
- **Inputs:** `rider_id`, `pickup_date`, `pickup_time`, `reasons` (a list of short strings).
- **Outputs:** a signed draft and its `draft_id`. Code builds the trip by merging the parsed note
  with the rider file under the design's merge rules, then validates it with `TripSchema`.
- **Failure cases:** unknown rider, or a missing date or time, returns `is_error` so the agent can
  recover. A trip that fails `TripSchema` returns `is_error`.
- **Acceptance criteria:**
  - Nothing is written: the history store is unchanged after a call.
  - The name always comes from the rider file.
  - "usual place" or no pickup in the note uses the file's home, badged "from rider file, confirm".
  - Drop-off, date and time never come from the rider file.
  - Mobility in the note wins; a difference from the file is kept and marked as a conflict.
  - A changed byte in the draft fails signature verification.
  - Each failure case returns `is_error` and does not throw.

**`ask_dispatcher`** (ends the run)

- **Purpose:** ask the dispatcher one question when the agent would otherwise guess.
- **Inputs:** `question` (string) and `options` (at most 4, each `{ label, rider_id? }`).
- **Outputs:** the question, the options and a signed resume token that holds the options.
- **Failure cases:** no options, more than 4 options, or a `rider_id` that matches no rider, each
  returns `is_error`.
- **Acceptance criteria:**
  - Five options return `is_error`.
  - An option that was not offered is rejected when the token is checked.
  - An expired or altered token is rejected.
  - Two Marias produce a question with one option per Maria (also an eval case, TC-6).

## Non-goals

Unchanged from the design: no riders or vehicles tables, no booking or dispatching, no update and no
delete, no agent framework, no dollar figures in the UI. Also out of scope here: memory across runs,
more than one agent, MCP servers and Managed Agents. Lesson 4 covers skills and MCP.

## What current guidance says

### The loop

- An agent is a model using tools in a loop on feedback from its environment. Use one only when the
  steps cannot be fixed in advance; otherwise a workflow is cheaper and more predictable. RideNote
  keeps Parse as the workflow and adds the agent beside it, which matches this advice.
- Start simple, keep the planning steps visible, and put real effort into the tool interface. These
  are Anthropic's three principles, and the step timeline is the "visible" part.
- Every loop needs a stopping condition other than the model's own choice: a step cap, a token cap
  and a time limit. OpenAI's guide lists the same exits (final output, error, maximum turns).
- Anthropic's docs now recommend the SDK **tool runner** as the default for custom-tool agents, and
  say that approval gates, error interception, result changes and an iteration cap do not need a
  hand-written loop. The lesson says to write the raw loop once first. Both can be true: see
  "Decisions".

### Message rules that break loops when missed

- Tool results go in the next user message, straight after the assistant message that asked for
  them, with `tool_result` blocks first and one per `tool_use` id.
- Append the model's whole `content` array, not only its text.
- Parse tool input as JSON. Never match on the raw string.
- A reply cut off by `max_tokens` can contain a tool call with partial input that still parses.
  Check `stop_reason` before running any tool, and never run tools from a `refusal`.
- If a reply contains several tool calls, answer all of them in one user message.

### Tools

- Write few, distinct tools. Describe each as you would to a new teammate, and say when to call it.
- Use unambiguous parameter names (`rider_id`, not `id`) and enums for fixed sets.
- Return high-signal results: names a person can read, only the needed fields, capped length. Every
  token returned is sent again on each later step.
- Make error messages actionable: say what was wrong and what to do next.
- `strict: true` guarantees inputs match the schema. It needs `additionalProperties: false`, and it
  does not support string length or numeric range limits, so those checks stay in Zod.

### Safety

- The model's permissions are the tools' permissions. Keep read tools and write actions apart, and
  put a person in front of anything that writes. OWASP's agent guidance names the same controls:
  least privilege, least agency, human approval for risky actions, and budgets.
- Treat tool results and user text as data. Keep untrusted text inside `tool_result` blocks, never
  in the system prompt.
- Require a lookup before any fact is stated, and have code, not the model, carry facts forward.
  The design already does this with `rider_id`.

### Evals

- Grade the path as well as the answer, on realistic multi-step tasks with a checkable outcome.
- Track tool-call counts, tokens, time and tool errors next to accuracy.
- Read the transcripts, and keep some cases held out so the prompt is not tuned to the test.

## Where the 2026-10-29 design should change

| #   | Finding                                                                                                                                                                                                                                                                                | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | The design forces one tool per step with `tool_choice: any`. Anthropic's current docs say forced tool choice returns a 400 on Claude Sonnet 5.5, Opus 5.5 and Fable 5.1 and later. It still works on Haiku 5.5, the configured model, but `MODEL` and `AGENT_MODEL` can be overridden. | Keep forced choice on Haiku 5.5. Add a guard that fails at start-up with a clear message if the agent model is one that rejects it, as `thinkingFor` already does for thinking. Add a test.                                                                                                                                                                                                                                                                                    |
| 2   | With `tool_choice: auto` (the fallback on those models) a call is not guaranteed.                                                                                                                                                                                                      | Whatever the mode, the loop treats "no tool call" as a named failure (`no_tool_call`), with one re-prompt at most. This also covers AL-2.                                                                                                                                                                                                                                                                                                                                      |
| 3   | The design marks "strict accepts what `z.toJSONSchema` produces" as unverified.                                                                                                                                                                                                        | Verify it first in week 4. Strict rejects length and range keywords, so either strip them from the generated schema or hand-write the four small schemas. **Result (2026-11-13):** the four hand-written strict schemas were accepted by the API on `claude-haiku-5-5` (the default model) with `tool_choice: any`, so forced choice also works there (finding 1). The model called `find_rider` once and the input passed `FindRiderInput`. 1,654 input and 42 output tokens. |
| 4   | The failure reasons do not include a tool call cut off by `max_tokens`. With 400 output tokens per step this is likely for `ask_dispatcher` with four options.                                                                                                                         | `cut_off` must cover "tool call present but `stop_reason` is `max_tokens`". Measure output tokens per step in week 5 and raise `maxStepTokens` if any real call comes close.                                                                                                                                                                                                                                                                                                   |
| 5   | The tool runner is now the documented default, and it has an iteration cap and per-step hooks.                                                                                                                                                                                         | Keep the hand-written loop in production: the design needs up-front budget reservation and one streamed event per step, and the runner is still beta. Keep the runner as the week 5 comparison script, as planned.                                                                                                                                                                                                                                                             |
| 6   | Prompt caching has a minimum prefix length that depends on the model. The agent prefix is estimated at 1,300 tokens.                                                                                                                                                                   | Do not plan on cache savings. Log `cache_read_input_tokens` per step and report what was measured.                                                                                                                                                                                                                                                                                                                                                                             |
| 7   | The design's phase dates (Oct 30 to Nov 7) have passed.                                                                                                                                                                                                                                | Re-date in the build plan to the task's dates: tools by Nov 15, loop, evals and docs by Nov 22.                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | `.nvmrc` asks for Node 22. The machine used on 2026-11-13 has Node 20.14.0, and one dependency warns it wants 20.19 or later.                                                                                                                                                          | Move to Node 22 before starting, so local runs match CI.                                                                                                                                                                                                                                                                                                                                                                                                                       |

| 9 | The task asks to "log every step for replay". The repository rule is that logs never hold the note or anything parsed from it, and the design's route log follows that rule, so it cannot replay a run. | Record full steps only where the data is invented: the script, the scripted loop tests and the eval runs, written to a git-ignored file per run. The production route keeps its numbers-only log. A replay test feeds a recorded run to the loop with a fake model and expects the same ending. |

### The design's defaults, reviewed

The design settled 12 decisions with defaults "to review later". The first week 4 sub-task is to
confirm or change them. This PRD's recommendation:

| #   | Default                                                           | Recommendation                                                            |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Riders and vehicles are fixtures, no tables                       | Keep                                                                      |
| 2   | The agent writes nothing; Approve inserts a signed draft          | Keep                                                                      |
| 3   | Hand-written loop in production, tool runner as a comparison      | Keep (finding 5)                                                          |
| 4   | Browser time zone, server clock, `America/New_York` fallback      | Keep; already built in phase 2                                            |
| 5   | Each step calls exactly one tool                                  | Keep on Haiku 5.5, and add the model guard (findings 1 and 2)             |
| 6   | Date window: today to today + 60 days                             | Keep                                                                      |
| 7   | Caps: 6 steps, 20,000 tokens per run, 400 per step                | Keep 6 and 20,000. Measure the 400 in week 5 before fixing it (finding 4) |
| 8   | 3 agent runs per instance                                         | Keep; only matters once the route exists                                  |
| 9   | Agent 2 a minute in production (5 elsewhere), Approve 10 a minute | Keep; only matters once the route exists                                  |
| 10  | 60 s per run, 15 s per step plus 1 retry, `maxDuration` 90        | Keep                                                                      |
| 11  | Drafts and resume tokens expire after 15 minutes                  | Keep                                                                      |
| 12  | Seven FAQ entries move to a Performance page                      | Keep; part of the week 5 docs sub-task                                    |

Nothing else in the design conflicts with current guidance. Its main choices (code decides facts,
the agent writes nothing, an ending tool for questions, reservation before spend, a signed draft)
are stricter than the lesson and in line with the vendor material.

## Decisions for Mark

1. **Loop:** hand-written in production, tool runner as a comparison script. _Recommended; matches
   the lesson and the design._
2. **Model:** stay on `claude-haiku-5-5` for the agent, with the guard from finding 1.
   _Recommended; it is the model the evals were tuned on._
3. **Schemas:** hand-write the four tool schemas and test that each matches its Zod schema.
   _Recommended over generating them; four small schemas are easy to read in a review._
4. **Scope for Nov 22:** _decided by Mark, 2026-11-13._ Week 5 includes the route, page and
   Approve (design phase 3) as well as the task's list, with the design's cut line and the order of
   work under "Scope by week".
5. **Where the PRD's requirement IDs live:** add them to the Requirements page when the feature
   ships, not before.

## Success measures

- All seven Todoist sub-tasks are ticked, each with a test, an eval case or a doc that proves it.
- All Lesson 2 exercise items are ticked, including the route, the steps in the page and Approve.
- Live agent evals: the five critical cases pass 3 of 3; overall pass rate is 90% or better.
- A complete note with a known rider ends `proposed` in 3 steps or fewer.
- A typical run stays under 6,000 tokens; no run exceeds 20,000.
- Parse's latency and error rate do not change while agent runs are in flight.
- `npm run check`, Playwright and the parser eval floor stay green on every commit.

## Risks

| Risk                                                                                       | Mitigation                                                                                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Week 5 holds more than half the work: loop, evals, step log, route, page, Approve and docs | The order of work under "Scope by week" finishes the task's own list first; the cut line drops resume and the comparison panel |
| A model change breaks forced tool choice                                                   | The start-up guard and its test (finding 1)                                                                                    |
| Agent runs spend the shared budget and Parse starts refusing                               | Reservation, the separate gate, per-client limits, and the firewall rule                                                       |
| The coverage floor (98/95/98/98) slows the route work                                      | Keep the loop a pure function with a fake model, so every branch has a test                                                    |
| Live evals are flaky on the ambiguity cases                                                | Run critical cases 3 times, pin `now`, and read transcripts before tuning                                                      |

## Open questions

1. The Todoist task has no sub-task for the route, the page or Approve. Should one be added, due
   Nov 22?
2. The script in design phase 1 (`scripts/agent.ts`) is not in the task. This PRD keeps it as the
   way to run the tools and the loop by hand and to record a run. Is that wanted?
3. Is the firewall rule for `/api/parse` now in Deny mode? The agent routes go live in week 5 and\n should start in the same mode.
4. Has the Anthropic spend cap been confirmed? It should be before the live agent evals run, and
   before any route that can make up to seven calls per request goes live.

## Next step

When Mark has reviewed this, write the build plan with `superpowers:writing-plans`, starting with
the week 4 tools and their unit tests.

## Sources

- Todoist task "RideNote agent: Weeks 4–5 (tool calling + agent loop)" and the linked "8-Week AI Learning & LinkedIn Post Plan" (Mark's own; read 2026-11-13)
- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (Anthropic)
- [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) (Anthropic)
- [Handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls) (Claude Platform docs)
- [Tool use overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) (Claude Platform docs)
- [A practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf) (OpenAI; read through summaries only)
- [OWASP Top 10 for Agentic Applications 2026](https://www.aigl.blog/owasp-top-10-for-agentic-applications-2026.md) (secondary summary; the OWASP PDF was not read)
