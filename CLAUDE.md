# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

RideNote turns a dispatcher's free-text note into a structured trip record (passenger, pickup, dropoff, time, mobility aids). Fields the note does not state are marked missing, never guessed. Next.js 16 (App Router), Claude API via `@anthropic-ai/sdk`, Zod, React Query, Zustand. `AGENTS.md` warns this Next.js has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code.

## Commands

```bash
npm run dev            # dev server (needs ANTHROPIC_API_KEY in .env.local, or use `npm run dev:key` on a Mac to read it from the Keychain)
npm run check          # typecheck + lint + prettier --check + jest; same as the pre-commit hook and CI
npm test               # jest unit/component tests (jsdom)
npx jest lib/extract   # single test file (path pattern); add -t "name" for one test
npm run test:coverage  # jest has a coverage floor (98/95/98/98): the run fails if it erodes
npm run test:e2e       # Playwright (first run: npx playwright install chromium)
npm run eval           # live accuracy eval against the real model (spends API credit; `eval:key` uses the Keychain key)
npm run format         # prettier --write
```

`npm run typecheck` runs `next typegen` first, so route types are generated before `tsc`. The pre-commit hook (`.githooks/pre-commit`, enabled by `npm install`) refuses env files and runs the full `check`.

## Architecture

**Parse path** (`app/api/parse/route.ts`): the single route that spends money. In order: per-client rate limit (`lib/rate-limit.ts`, 3/min in production, 10/min elsewhere, keyed on `x-real-ip`, never the client-written first `x-forwarded-for` hop) → content-type/size checks (`lib/read-body.ts`) → Zod validation (`lib/validation.ts`) → coalescing of identical in-flight notes (`lib/coalesce.ts`) → concurrency gate and a shared global call budget (`lib/concurrency.ts`, `BUDGET` in config) → `extractTrip` (`lib/extract.ts`, `lib/prompt.ts`) → output validation, normalisation and `missing_fields` derivation (`lib/trip.ts`). Model output is never trusted: lengths are capped by `OUTPUT_LIMITS`. User-facing error strings live in `lib/messages.ts`; the out-of-credit case is detected by `lib/upstream-errors.ts` and surfaces as 503 with code `out_of_credit`.

**Config**: every tunable number or name (limits, budgets, model, token cap, HTTP codes, mobility vocabulary, history retention) lives in `lib/config.ts`. Reasoning is deliberately disabled for the model call; read the comments there before changing `UPSTREAM`.

**History** (public, read-only page of recently parsed trips): production-only. `historyEnabled()` in `lib/history.ts` requires `VERCEL_ENV=production` and `HISTORY_DATABASE_URL`; nowhere else is a DB connection opened. Only the parsed trip is saved, never the raw note, `notes` or `missing_fields`, and contact details are stripped by `lib/scrub.ts` first. Token counts and latency (`lib/usage.ts`) are saved with each row and rated against the median by `lib/usage-compare.ts`. The store is a `HistoryStore` interface with Postgres (`lib/history-postgres.ts`, Neon serverless) and in-memory (`lib/history-memory.ts`) implementations. Saving happens in `after()` and must never affect the parse response. A daily Vercel cron (`vercel.json`) hits `/api/history/purge`, which requires `CRON_SECRET` and deletes rows older than 7 days.

**Database** (`db/schema.sql`, `db/migrations/`): no migration tool. SQL is run by hand in the Neon console. Two least-privilege roles are created by the script: `history_app` (INSERT, SELECT; `HISTORY_DATABASE_URL`) and `history_purge` (SELECT, DELETE; `HISTORY_PURGE_DATABASE_URL`). The script ends with a self-check that fails if a role holds more than its grants. Never put passwords in the repo. `tests/history-readonly.test.ts` and `tests/history-docs.test.ts` guard these properties.

**Frontend**: `components/` (NoteForm, ResultPanel, TripCard, HistorySection…), React Query for the parse mutation (`lib/use-parse-note.ts`, `lib/api-client.ts`), Zustand for client state (`lib/store.ts`). `app/docs/*` pages render markdown from `docs/` at build time via `lib/docs-source.ts`, which fails the build on a missing or empty file. `lib/test-catalog.ts` scans test files' `describe`/`it` titles to render the Tests page, so keep test titles literal strings.

## Testing notes

- Tests are colocated (`foo.test.ts` beside `foo.ts`); cross-cutting guards are in `tests/` (repo hygiene, privacy claims, a11y with jest-axe, next config/CSP). `tests/repo-hygiene.test.ts` inspects `git ls-files`, so it checks tracked files only.
- Some tests assert that README/docs text matches `lib/config.ts` values (e.g. rate limits, env var names). Changing a limit or env var usually means updating `README.md` too.
- Playwright (`playwright.config.ts`) starts `npm run dev` on port 3100 with production-like History: `VERCEL_ENV=production`, in-memory store (`HISTORY_STORE=memory`), and `E2E_STUB_PARSE=1`. The stub (`lib/e2e-stub-client.ts`) answers notes of the form `E2E:{...trip JSON...}` and refuses to run in a production build; any other note throws. Real validation, scrubbing and saving still run.
- `evals/` holds live-model accuracy cases and a scorer; only `evals/score.test.ts` runs under normal `jest`.

## Conventions

- Env vars: `ANTHROPIC_API_KEY` (never `NEXT_PUBLIC_`), optional `MODEL`, and the three History variables (production only). See `.env.example`. `.env.local` is git-ignored.
- Per-call usage is logged as single-line JSON containing numbers, model name and stop reason only, never the note or anything parsed from it.
- Plans and specs for features are kept in `docs/superpowers/plans/` and `docs/superpowers/specs/`.
