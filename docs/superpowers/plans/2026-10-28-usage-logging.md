# Per-call usage logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log one numbers-only line per paid model call: model, tokens, stop reason, latency.

**Architecture:** `extractTrip` returns a `meta: CallMeta` on every outcome it reaches the model for. The route's `callModel` logs it with `console.info`. Calls that throw keep the existing error-type log and get no usage line.

**Tech Stack:** Next.js (read `node_modules/next/dist/docs/` before touching route code, per AGENTS.md), `@anthropic-ai/sdk`, Jest.

**Spec:** `docs/superpowers/specs/2026-10-28-usage-logging-design.md`

## Global Constraints

- Logs carry numbers, the model name and the stop reason only; never note text or trip content.
- Logging lives in the route, not in `lib/`.
- Tests sit next to the code; `npm run check` passes before every commit.
- Git commits carry no Claude/Co-Authored-By lines (author is Mark Guerrero).
- No dollar estimate, no panel, nothing sent to the browser.

## Review Focus

- Refusal / `max_tokens` outcome: still logs a usage line (covered in Task 1 and 2).
- Model call throws (timeout): no usage line, existing error-type log unchanged (Task 2).
- Coalesced identical notes: one usage line, not two (Task 2).
- SDK `usage` missing cache fields (`null`/`undefined`): logged as `0`, not `NaN`/`null` (Task 1).
- Log line never contains the note text (Task 2).

---

### Task 1: `extractTrip` returns `meta`

**Files:**

- Modify: `lib/extract.ts`
- Modify: `lib/e2e-stub-client.ts`
- Create: `lib/extract.test.ts`

**Interfaces:**

- Produces: `export type CallMeta = { model: string; inputTokens: number; outputTokens: number; cacheRead: number; cacheWrite: number; stopReason: string | null; latencyMs: number }`; `Extraction` becomes `({ ok: true; trip: Trip } | { ok: false; status: number; error: string }) & { meta: CallMeta }`.

- [ ] **Step 1: Write failing tests in `lib/extract.test.ts`** using a fake `{ messages: { parse } }` client. Cases, each asserting `result.meta`:
  - `end_turn` with `usage: { input_tokens: 120, output_tokens: 160, cache_read_input_tokens: 5, cache_creation_input_tokens: 7 }` gives `meta` containing those four as `inputTokens: 120, outputTokens: 160, cacheRead: 5, cacheWrite: 7`, `stopReason: "end_turn"`, `typeof latencyMs === "number"`, `model` equal to the model passed in the request.
  - `stop_reason: "refusal"` returns `ok: false` and still has `meta.stopReason === "refusal"`.
  - `stop_reason: "max_tokens"` returns `ok: false, status: 502` with `meta.outputTokens` populated.
  - `usage` with cache fields `null` gives `cacheRead: 0, cacheWrite: 0`.
  - Invalid `parsed_output` returns `ok: false` with `meta` present.

- [ ] **Step 2: Run** `npx jest lib/extract.test.ts`. Expected: FAIL (`meta` undefined).

- [ ] **Step 3: Implement in `lib/extract.ts`.** Export `CallMeta`; add `meta` to `Extraction`. Compute `model` once (same expression as today), time only the `client.messages.parse` call with `performance.now()`, build `meta` from `res.usage` with `?? 0` for each count, attach to every return after the call. Update the stub in `lib/e2e-stub-client.ts` to return `usage: { input_tokens: 0, output_tokens: 0 }` so `meta` is well-formed.

- [ ] **Step 4: Run** `npx jest lib/extract.test.ts lib/e2e-stub-client.test.ts`. Expected: PASS. Run `npx tsc --noEmit`; fix any type fallout in callers (`evals/parser.eval.ts` only reads `ok`/`trip`, expected unaffected).

- [ ] **Step 5: Commit** `feat: extractTrip returns usage, stop reason and latency`

### Task 2: Route logs the usage line

**Files:**

- Modify: `app/api/parse/route.ts` (in `callModel`, after `extractTrip` returns, before the `!result.ok` early return)
- Modify: `app/api/parse/route.test.ts`

**Interfaces:**

- Consumes: `Extraction.meta: CallMeta` from Task 1.
- Produces: `console.info("parse usage:", meta)` once per paid call.

- [ ] **Step 1: Write failing tests in `route.test.ts`** (spy `console.info` in `beforeEach` alongside the existing `console.error` spy; add helper `infoText()` mirroring `loggedText`):
  - Successful parse: `console.info` called once with `"parse usage:"` and an object containing `stopReason: "end_turn"`, numeric `inputTokens`/`outputTokens`/`latencyMs`.
  - Refusal outcome: usage line still logged, response unchanged.
  - Two identical concurrent notes (existing coalescing test setup): `console.info` called once.
  - Model call throws: `console.info` not called with `"parse usage:"`; `console.error` still logs the error type.
  - `infoText()` never contains the note text (reuse the "Oak St" style assertion from the PII test).

- [ ] **Step 2: Run** `npx jest app/api/parse/route.test.ts`. Expected: new tests FAIL.

- [ ] **Step 3: Implement** the single `console.info("parse usage:", result.meta)` call in `callModel`. Keep the comment convention: numbers only, no content.

- [ ] **Step 4: Run** `npx jest app/api/parse`. Expected: PASS (other route test files may need the same `console.info` spy if they print noise).

- [ ] **Step 5: Commit** `feat: log tokens, stop reason and latency per model call`

### Task 3: Docs match the new logging

**Files:**

- Modify: `docs/FAQ.md:58`, `app/docs/page.tsx:685` (and the matching FAQ page text if it repeats the sentence), `docs/GUIDE.md:366` and `:839`, `docs/BEST-PRACTICES.md:87`
- Test: `tests/privacy-claims.test.ts` (extend)

- [ ] **Step 1: Add failing test** to `tests/privacy-claims.test.ts`: `docs/FAQ.md` and `app/docs/page.tsx` must not match `/log[s]? record only an error/i`.

- [ ] **Step 2: Run** `npx jest tests/privacy-claims.test.ts`. Expected: FAIL.

- [ ] **Step 3: Reword** to: "Server logs record an error type, plus token counts, stop reason and latency per model call. Never the note." Keep the "never log request content" rule in BEST-PRACTICES and GUIDE intact; only add that numeric usage is logged.

- [ ] **Step 4: Run** `npm run check`. Expected: all green.

- [ ] **Step 5: Commit** `docs: describe the per-call usage log line`
