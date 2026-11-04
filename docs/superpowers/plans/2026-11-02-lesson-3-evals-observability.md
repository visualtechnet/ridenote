# Lesson 3 (Evals & Observability) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Lesson 3 artefacts RideNote lacks (prompt version and request id on the log line, dated results files, a harder eval set with a failure taxonomy, one recorded prompt change, a Haiku-versus-Sonnet comparison, and a README "How I evaluated this" section) without rebuilding the eval that already exists.

**Architecture:** The runner (`evals/parser.eval.ts`) keeps calling `extractTrip` and the scorer; it gains a results writer that saves every case's answer, verdict and usage to a dated JSON file under `evals/results/`, and a summariser that turns a file into pass rate, cost and latency. The log line in the parse route gains a request id, a timestamp and a prompt version computed from the prompt text. New cases carry tags; a guard test keeps the README's numbers equal to the latest results file.

**Tech Stack:** TypeScript, Jest (unit and the separate eval config), `@anthropic-ai/sdk`, `node:crypto` for the prompt hash.

**Spec:** `docs/superpowers/specs/2026-11-02-lesson-3-evals-observability.md`

## Global Constraints

- Invented notes only. No real names, addresses, numbers or patient details anywhere in `evals/`.
- The log line never carries the note or anything parsed from it (`app/api/parse/route.test.ts` asserts this; keep it true).
- Every commit passes `npm run check` (typecheck, lint, prettier, Jest with the 98/95/98/98 coverage floor).
- Test titles are literal strings (the Tests page scans them).
- Prices: Haiku 5.5 $0.10 in / $0.50 out per million tokens; Sonnet 5.5 $2.00 / $10.00 (Claude API reference, cached 2026-10-06).
- Model ids: `claude-haiku-5-5` (default), `claude-sonnet-5-5` (comparison). Sonnet 5.5 rejects `thinking: { type: "disabled" }`; send `{ type: "between_tools" }` to it.
- The docs guard `tests/privacy-claims.test.ts` requires the phrase "token counts, stop reason and latency" in `docs/FAQ.md` and `app/docs/page.tsx`; extend those sentences, never replace the phrase.
- Each eval run spends API credit. Run Haiku freely (cents); run Sonnet once for the comparison and once more only if the first run fails for a non-model reason.

## Review Focus

1. The eval skipped for want of a key must write no results file, or an empty baseline becomes "evidence". Pinned in Task 2's writer test (`writeResults` is only called from inside the `beforeAll` that runs cases).
2. A results file for one model must never be read as another model's baseline by the README guard. Pinned in Task 8's test (`latestResults(model)` filters by the `model` field, not the file name).
3. A messy note with a phone number inside it must still be a note the API accepts and must not put the number into an address field. Pinned in Task 4's cases (expectations on `pickup_location`) and the existing `validateNote` check in `evals/score.test.ts`.
4. The prompt version must change when one character of the prompt changes and stay stable across processes. Pinned in Task 1's test.
5. A `between_tools` thinking setting must reach Sonnet and a `disabled` one must still reach Haiku, or every parse on one of them 400s. Pinned in Task 3's test.

---

### Task 1: Request id, timestamp and prompt version on the log line

**Files:**

- Modify: `lib/prompt.ts` (export `PROMPT_VERSION`)
- Modify: `lib/prompt.test.ts`
- Modify: `app/api/parse/route.ts:103-107`
- Modify: `app/api/parse/route.test.ts:521-560`
- Modify: `docs/FAQ.md:58`, `app/docs/page.tsx:691`, `README.md` (the Security bullet that describes logs, near line 489)

**Interfaces:**

- Produces: `PROMPT_VERSION: string` in `lib/prompt.ts`, the first 8 hex characters of `sha256(SYSTEM)`. Used by Task 2's results file and the log line.

- [ ] **Step 1: Write the failing tests**

In `lib/prompt.test.ts`:

```ts
describe("PROMPT_VERSION", () => {
  it("is a short hash of the fixed prompt text, so an edit cannot go unversioned", () => {
    expect(PROMPT_VERSION).toMatch(/^[0-9a-f]{8}$/);
    expect(PROMPT_VERSION).toBe(createHash("sha256").update(SYSTEM).digest("hex").slice(0, 8));
  });
});
```

In `app/api/parse/route.test.ts`, extend "logs one numbers-only usage line per paid call":

```ts
expect(meta).toMatchObject({
  event: "llm_call",
  requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
  promptVersion: PROMPT_VERSION,
  ...
});
```

And a new test: "gives every call its own request id" (two POSTs, the two `requestId`s differ).

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx jest lib/prompt app/api/parse/route.test -t "PROMPT_VERSION|usage line|request id"`
Expected: FAIL (`PROMPT_VERSION` is not exported; `event` missing from the line).

- [ ] **Step 3: Implement**

`lib/prompt.ts`: `export const PROMPT_VERSION = createHash("sha256").update(SYSTEM).digest("hex").slice(0, 8);` (import from `node:crypto`; this module is server-only, no client component imports it).

`app/api/parse/route.ts`: build `const requestId = crypto.randomUUID()` before `extractTrip` and log
`JSON.stringify({ event: "llm_call", requestId, at: new Date().toISOString(), promptVersion: PROMPT_VERSION, ...result.meta })` with the same `"parse usage:"` label. One line, no note content.

Docs: in the three places, change "token counts, stop reason and latency per model call" to "token counts, stop reason and latency per model call, with a request id and the prompt version" (the guard phrase stays intact).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest lib/prompt app/api/parse tests/privacy-claims`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/prompt.ts lib/prompt.test.ts app/api/parse/route.ts app/api/parse/route.test.ts docs/FAQ.md app/docs/page.tsx README.md
git commit -m "feat(observability): request id, timestamp and prompt version on every usage log line"
```

---

### Task 2: A dated results file per eval run, with totals and cost

**Files:**

- Create: `evals/prices.ts`
- Create: `evals/results.ts`
- Create: `evals/results.test.ts`
- Create: `evals/results/.gitkeep`
- Modify: `evals/parser.eval.ts`
- Modify: `docs/EVAL.md` (new section "Results files and baselines")

**Interfaces:**

- Consumes: `CaseResult` from `evals/score.ts`; `CallMeta` from `lib/extract.ts`; `PROMPT_VERSION` from Task 1.
- Produces, in `evals/results.ts`:
  - `type CaseRow = { name: string; critical: boolean; tags: string[]; pass: boolean; flaky: boolean; attempts: number; problems: string[]; answer: Trip | null; inputTokens: number; outputTokens: number; latencyMs: number }` (tokens and latency summed over the case's attempts; `answer` is the last attempt's trip, null when the request failed).
  - `type RunSummary = { model: string; promptVersion: string; date: string; cases: number; passed: number; passRate: number; criticalFailed: number; inputTokens: number; outputTokens: number; costUsd: number; costPerCaseUsd: number; meanLatencyMs: number; medianLatencyMs: number }`.
  - `type ResultsFile = RunSummary & { rows: CaseRow[] }`.
  - `summariseRun(rows: CaseRow[], model: string, promptVersion: string, date: string): RunSummary`.
  - `resultsPath(date: string, model: string, label?: string): string` returning `evals/results/<date>-<model>[-<label>].json`.
  - `writeResults(file: ResultsFile, path: string): void` (pretty JSON, trailing newline).
  - In `evals/prices.ts`: `PRICES: Record<string, { inputPerMillion: number; outputPerMillion: number }>` for the two model ids, with `PRICES_AS_OF = "2026-10-06"`, and `costUsd(model, inputTokens, outputTokens): number` (0 for an unknown model).

- [ ] **Step 1: Write the failing tests** (`evals/results.test.ts`, node environment)

- "prices the two models and charges nothing for an unknown one": `costUsd("claude-haiku-5-5", 1_000_000, 1_000_000)` is `0.6`; `costUsd("claude-sonnet-5-5", 1_000_000, 0)` is `2`; `costUsd("other", 1, 1)` is `0`.
- "summarises pass rate, critical failures, tokens, cost and latency": three rows (one critical failing, latencies 100/200/900) give `passed 2`, `passRate` ≈ `0.667`, `criticalFailed 1`, `medianLatencyMs 200`, `meanLatencyMs 400`, `costUsd` equal to `costUsd(model, Σin, Σout)`, `costPerCaseUsd = costUsd / 3`.
- "names the file by date and model, with an optional label": `resultsPath("2026-11-02", "claude-haiku-5-5")` is `evals/results/2026-11-02-claude-haiku-5-5.json`; with label `"after-shorthand"` the label is appended before `.json`.
- "writes pretty JSON with a trailing newline" (to a temp dir via `os.tmpdir()`).

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest evals/results`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `evals/prices.ts` and `evals/results.ts`**

Median: sort a copy, take the middle (mean of the two middles for even counts). Cost: `(in * inputPerMillion + out * outputPerMillion) / 1_000_000`.

- [ ] **Step 4: Wire the runner**

In `evals/parser.eval.ts`: make `run` return `{ problems, meta, trip }` so each attempt's usage and answer are kept; build a `CaseRow` per case; after the summary line, call `writeResults` to `resultsPath(today, model, process.env.EVAL_LABEL)` and print the path. `today` is the real date (`new Date().toISOString().slice(0, 10)`), not `CLOCK`. Print `costUsd` and `medianLatencyMs` in the console summary too.

- [ ] **Step 5: Run the unit tests and the live eval once**

Run: `npx jest evals` then `npm run eval:key`
Expected: tests PASS; the eval prints the path of `evals/results/2026-11-02-claude-haiku-5-5.json` and the file has 49 rows. Keep this file: it is the pre-messy baseline.

- [ ] **Step 6: Document and commit**

`docs/EVAL.md`, new section "Results files and baselines": what a file holds, that it is committed, the `EVAL_LABEL` env var, and that cost uses the prices in `evals/prices.ts` as of `PRICES_AS_OF`.

```bash
git add evals/prices.ts evals/results.ts evals/results.test.ts evals/results/ evals/parser.eval.ts docs/EVAL.md
git commit -m "feat(eval): save every run as a dated results file with pass rate, cost and latency"
```

---

### Task 3: A thinking setting the comparison model accepts

**Files:**

- Modify: `lib/config.ts:48-62` (replace the fixed `thinking` with a function)
- Modify: `lib/extract.ts:63-66`
- Create or modify: `lib/config.test.ts` (create if absent)
- Modify: `lib/extract.test.ts` (one test)

**Interfaces:**

- Produces: `thinkingFor(model: string): { type: "disabled" } | { type: "between_tools" }` in `lib/config.ts`. `between_tools` for a model id starting `claude-sonnet-5`; `disabled` otherwise. `UPSTREAM.thinking` is removed.

- [ ] **Step 1: Write the failing tests**

`lib/config.test.ts`: "turns thinking off the way each model accepts": `thinkingFor("claude-haiku-5-5")` is `{ type: "disabled" }`; `thinkingFor("claude-sonnet-5-5")` is `{ type: "between_tools" }`.

`lib/extract.test.ts`: "sends the thinking setting that fits the model": with `process.env.MODEL = "claude-sonnet-5-5"`, the `create` call's `thinking` is `{ type: "between_tools" }`; without `MODEL`, `{ type: "disabled" }`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest lib/config lib/extract -t "thinking"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Keep the existing comment block about why thinking is off; add one line on why Sonnet 5.5 gets `between_tools` (it rejects `disabled` with a 400; `between_tools` is its off switch at effort high or below).

- [ ] **Step 4: Run tests**

Run: `npx jest lib/config lib/extract lib/prompt`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/config.ts lib/config.test.ts lib/extract.ts lib/extract.test.ts
git commit -m "feat(config): choose the thinking-off setting per model so Sonnet 5.5 can be evaluated"
```

---

### Task 4: The messier cases, tagged, and the first baseline on them

**Files:**

- Modify: `evals/cases.ts` (add `tags?: string[]` to `EvalCase`; append the cases under a `// --- Messier notes ---` banner)
- Modify: `evals/score.test.ts`
- Modify: `app/docs/eval/page.tsx` (show tags in the cases table, one extra column)

**Interfaces:**

- Produces: `MESSY_TAGS` exported from `evals/cases.ts`: `["shorthand", "caps", "typos", "two-addresses", "contact-in-note", "noise", "second-trip", "date-edge"] as const`; `EvalCase.tags?: (typeof MESSY_TAGS)[number][]`.

- [ ] **Step 1: Write the failing guard tests** in `evals/score.test.ts`

- "include at least 20 messier cases, each tag used at least three times": count cases with tags; for each of `MESSY_TAGS`, at least 3 cases carry it.
- "every tag on a case is a known tag" (type-checked, but the runtime check keeps a stray string out of the docs table).
- "a contact detail inside a note never becomes an address": for every case tagged `contact-in-note`, `expect.pickup_location` and `expect.dropoff_location` are set (a pattern or null), so the scorer checks them.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest evals/score -t "messier|known tag|contact detail"`
Expected: FAIL.

- [ ] **Step 3: Write the cases**

At least 20, invented, all accepted by `validateNote` (5 to 1,000 characters, no markup, no hidden characters). Shapes and what each must assert:

- `shorthand` (3+): "PU 0930 Mrs Lopez 14 Elm → St Clare's, d/o main ent, w/c" style; assert `pickup_time`, `mobility`, pickup and dropoff patterns. One critical.
- `caps` (3+): ALL CAPS, no punctuation; assert time, mobility and name pattern.
- `typos` (3+): "pikc up", "tomorow", "whelchair", "dialisis"; assert the intended values; one with "tomorow 9:30" asserts `pickup_date: "2026-11-03"`.
- `two-addresses` (3+): pickup, dropoff, and a third place (a pharmacy stop, a billing address); assert pickup and dropoff patterns that exclude the third.
- `contact-in-note` (3+): a phone number and an email inside the note; assert pickup and dropoff patterns that exclude digits of the number and the `@`; assert `passenger_name` pattern.
- `noise` (3+): a pasted email with greeting, signature, a disclaimer; assert the trip fields and `missing: []` where complete.
- `second-trip` (3+): "to the clinic and back at 3", two trips in one note; assert the first trip's fields and `notes` mentioning another/return trip (loose pattern, as the existing "two trips" case does).
- `date-edge` (3+): "today" (2026-11-02), "tonight 7" (date today, 19:00), "day after tomorrow" (2026-11-04), "the 15th" (2026-11-15), "Monday" said on Monday (2026-11-02, the prompt says counting today), and "Sun Valley Clinic" with a plain weekday date (expect `pickup_date` null and `notes` matching `/sun/i`, documenting the known clearing; not critical).

Mark critical only where a wrong answer sends a vehicle somewhere wrong (an invented address, a wrong time).

- [ ] **Step 4: Run the guards and the cheap checks**

Run: `npx jest evals/score`
Expected: PASS, including "send a note the API would accept" for every new note.

- [ ] **Step 5: Show tags on the docs Eval page**

One extra column "Shapes" in the cases table; blank for untagged cases. Run `npx jest app/docs` and `npx playwright test e2e/docs-sections.spec.ts`. Expected: PASS (the table still lists `CASES.length` rows).

- [ ] **Step 6: Run the baseline on the enlarged set, before any prompt change**

Run: `EVAL_LABEL=before npm run eval:key`
Expected: a results file `evals/results/2026-11-02-claude-haiku-5-5-before.json`. The pass rate is expected to drop below 100%; the critical rule may fail the Jest run, which is fine here: the file is still written before the assertions, and this run's purpose is the file. Record `passed/cases` from the console.

- [ ] **Step 7: Commit**

```bash
git add evals/cases.ts evals/score.test.ts app/docs/eval/page.tsx evals/results/
git commit -m "test(eval): twenty messier invented notes, tagged by shape, with the baseline run on them"
```

---

### Task 5: Error analysis: open coding, then a taxonomy with counts

**Files:**

- Create: `evals/ERROR-ANALYSIS.md`
- Modify: `docs/EVAL.md` (new section "Error analysis" that summarises and links the file)

**Interfaces:**

- Consumes: the `before` results file from Task 4 (its `rows[].answer` and `rows[].problems`).

- [ ] **Step 1: Open coding**

For every failing row and for 15 passing rows from the messy set, write one line in `evals/ERROR-ANALYSIS.md` under "Open coding": case name, the first thing wrong with the answer (or "nothing wrong" for a pass worth noting), in plain words. Read the answers, not only the `problems` strings.

- [ ] **Step 2: Axial coding**

Group the notes into 3 to 5 failure categories (for example "shorthand not understood", "picked the wrong address of two", "invented a time from a vague phrase", "contact detail copied into a field"). A table: category, count, example case, whether a prompt rule could fix it. Name the largest category; it is the target of Task 6.

- [ ] **Step 3: Summarise in the docs**

`docs/EVAL.md`, section "Error analysis": the method in four sentences (collect, open coding, axial coding, fix the obvious ones in the prompt), the table copied in, and the date.

- [ ] **Step 4: Check and commit**

Run: `npm run check` (the docs page renders `EVAL.md` at build; `tests/privacy-claims` and the docs guards must stay green).

```bash
git add evals/ERROR-ANALYSIS.md docs/EVAL.md
git commit -m "docs(eval): error analysis of the messier set, with a failure taxonomy and counts"
```

---

### Task 6: One prompt change aimed at the largest category, recorded before and after

**Files:**

- Modify: `lib/prompt.ts` (one rule, or one glossary line, for the largest category)
- Modify: `lib/prompt.test.ts` (pin the new rule with a pattern, as the existing tests do)
- Modify: `evals/ERROR-ANALYSIS.md` (section "The change and its effect")

- [ ] **Step 1: Write the failing prompt test**

A test named for the rule, for example "translates dispatcher shorthand: PU, d/o and w/c", asserting `SYSTEM` matches a pattern that the new line will satisfy.

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest lib/prompt -t "<rule name>"`
Expected: FAIL.

- [ ] **Step 3: Make exactly one change to the prompt**

Add the rule under the section it belongs to. Nothing else in the prompt moves. `PROMPT_VERSION` changes by itself.

- [ ] **Step 4: Rerun the eval**

Run: `npx jest lib/prompt` (PASS), then `EVAL_LABEL=after npm run eval:key`.
Expected: `evals/results/2026-11-02-claude-haiku-5-5-after.json`. Compare `passed/cases` and the largest category's count against the `before` file.

- [ ] **Step 5: Record**

In `evals/ERROR-ANALYSIS.md`, "The change and its effect": the rule added, before and after pass rate, the category count before and after, both prompt versions, both file names. If the change helped nothing, say so and keep it only if it did not hurt; otherwise revert it and record that too. The honest failure for the README is the case that still fails after this change (choose the one a reader learns most from).

- [ ] **Step 6: Commit**

```bash
git add lib/prompt.ts lib/prompt.test.ts evals/ERROR-ANALYSIS.md evals/results/
git commit -m "feat(prompt): <one line naming the rule>; eval before and after recorded"
```

---

### Task 7: The second model, side by side

**Files:**

- Modify: `evals/ERROR-ANALYSIS.md` (section "Haiku 5.5 against Sonnet 5.5")
- Modify: `docs/EVAL.md` (section "Comparing models", the table)

- [ ] **Step 1: Run Sonnet once on the same set and prompt**

Run: `MODEL=claude-sonnet-5-5 EVAL_LABEL=after npm run eval:key`
Expected: `evals/results/2026-11-02-claude-sonnet-5-5-after.json`. If every call 400s, Task 3 is wrong; fix it before spending again.

- [ ] **Step 2: Write the table**

Columns: model, cases passed, pass rate, critical failures, mean and median latency (ms), tokens per case (in, out), cost per case (USD), cost per 1,000 parses (USD). One row per model, from the two `after` files. Below it, two sentences: what Sonnet got right that Haiku did not (name the cases), and the cost ratio. State the decision the numbers support, as the lesson's example does ("a bigger model added N points for M× the cost, so we kept the small one", or the reverse).

- [ ] **Step 3: Commit**

```bash
git add evals/ERROR-ANALYSIS.md docs/EVAL.md evals/results/
git commit -m "docs(eval): Haiku 5.5 against Sonnet 5.5 on the same set: pass rate, cost and latency"
```

---

### Task 8: README "How I evaluated this", with a guard that keeps its numbers true

**Files:**

- Modify: `README.md` (new section "How I evaluated this" under "Testing", and a Contents entry)
- Create: `tests/eval-claims.test.ts`
- Modify: `evals/results.ts` (add `latestResults(model: string, dir?: string): ResultsFile | null`)
- Modify: `evals/results.test.ts`

**Interfaces:**

- Produces: `latestResults(model, dir = "evals/results")`: reads every `*.json` in the directory, keeps those whose `model` field equals `model`, returns the one with the greatest `date`, ties broken by file name (so `-after` sorts after `-before`); null when none.

- [ ] **Step 1: Write the failing tests**

`evals/results.test.ts`: "finds the latest file for a model and ignores other models" (temp dir with three files: two models, two dates).

`tests/eval-claims.test.ts`:

- "the README's 'How I evaluated this' section quotes the latest Haiku results file": the section text contains `${passed} of ${cases}` and `claude-haiku-5-5`.
- "the README names one honest failure that is a real case": the section contains the name of a case whose latest `pass` is false (or, if every case passes, the section says so and this test asserts the sentence "every case passed" instead).
- "the README's model comparison quotes the latest Sonnet file": contains `claude-sonnet-5-5` and that file's `passed`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest evals/results tests/eval-claims`
Expected: FAIL.

- [ ] **Step 3: Implement `latestResults` and write the README section**

The section, in this order, each with the real numbers: the set (how many cases, how many critical, how many messy and the eight shapes); the method (code assertions, 3-of-3 for criticals, 2-of-3 otherwise, pinned clock); the baseline and the one prompt change, before and after; the model comparison with cost; one honest failure and why it is left; where the results files and the error analysis live. Specific sentences, the way the lesson's examples read.

- [ ] **Step 4: Run tests**

Run: `npm run check`
Expected: PASS, including `tests/eval-claims`.

- [ ] **Step 5: Commit**

```bash
git add README.md tests/eval-claims.test.ts evals/results.ts evals/results.test.ts
git commit -m "docs: How I evaluated this, with a test that keeps its numbers equal to the latest results"
```

---

## Self-review notes

- Spec coverage: request id, timestamp and prompt version (Task 1); dated results files (Task 2); second model runnable (Task 3); harder set (Task 4); error analysis (Task 5); before-and-after prompt change (Task 6); comparison with cost and latency (Task 7); README section with one honest failure (Task 8). The LLM-as-judge stretch and hosted tracing are out of scope by the spec.
- Types: `CaseRow`, `RunSummary`, `ResultsFile`, `summariseRun`, `resultsPath`, `writeResults`, `latestResults` are named the same in Tasks 2 and 8; `thinkingFor` in Task 3; `MESSY_TAGS` and `tags` in Tasks 4 and 2.
- Proportion: the plan decides files, names, signatures, test assertions and the order of runs; the case texts, the taxonomy and the prompt rule are decided during execution because they depend on what the model gets wrong.
