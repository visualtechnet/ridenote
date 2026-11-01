# RideNote review: specs, testing, security, performance and UX

Date: 2026-11-01. Branch `feature/parse-dates` (Phase 2 of the dispatch-agent design, built the same
day). Four read-only audits ran in parallel (security, testing and specs, performance, UX and
accessibility); their findings were spot-checked against the code before being kept. Anything not
verified is marked _(hypothesis)_. Line numbers are as of this branch.

## 1. Phase 2 outcome (dates for Parse)

Done, and the "done when" bar is met:

| Gate                      | Result                                                  |
| ------------------------- | ------------------------------------------------------- |
| `npm run check`           | green: typecheck, lint, prettier, 856 Jest tests        |
| `npm run test:coverage`   | 99.9% statements, 98.0% branches (floor 98/95/98/98)    |
| `npm run eval:key` (live) | 49/49 (100%), every critical case passing               |
| `npm run test:e2e`        | 143 Playwright tests passing, including a dated History |

What was built (see `docs/superpowers/plans/2026-11-01-parse-dates.md` for the step list):

- `pickup_date` (`YYYY-MM-DD` or null) on the trip, asked of the model, never a Missing chip.
- An injectable clock (`lib/clock.ts`): the route is the only reader of the system clock; evals and
  tests pin Monday 2026-11-02 in New York.
- Code checks the model's date (`lib/dates.ts`): real calendar date, equal to any numeric date the
  note writes, today to 60 days ahead, on the weekday the note names. A cleared date puts its reason
  first in `notes`.
- A vague part of the day ("morning") leaves the time null with "Confirm a specific pickup time".
- The browser sends its IANA zone; a bad zone silently falls back to `America/New_York`.
- History column, migration (`db/migrations/2026-11-01-pickup-date.sql`), card and History page.
- Eleven dated eval cases and a scorer that checks `pickup_date`.

Two things the live eval caught and that were fixed before the final run:

1. The first "vague time" wording made the model drop "9:30 in the morning" too. Reworded; the two
   regressed cases pass again.
2. The model "corrected" "Friday 11/5" to the Friday (11/6), which passed the weekday check. Code now
   also requires the date to equal any numeric date written in the note.

The testing audit found a third: a year-less date written near year end ("1/5" in December) resolved
to the past and was cleared. The prompt now resolves a year-less date to its next occurrence; a unit
test with a December clock and an eval case cover it.

## 2. Security

No critical or high findings. `npm audit` (prod and full) reports 0 vulnerabilities.

| Sev | Finding                                                                                                                                                                                                                                                                            | Fix                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Med | Cost ceilings are per instance: the client limit, the 300/min budget and the gate of 10 live in module memory (`app/api/parse/route.ts:19-39`). Under scale-out the real ceiling is N× those numbers; the API key spend cap is the backstop and the repo cannot confirm it is set. | Add the Vercel Firewall rule (still pending per the History rollout notes); confirm the Anthropic spend limit; consider a shared store only if abuse appears. |
| Med | Anyone can publish text to the public History page. Scrubbing (`lib/scrub.ts`) is pattern-based: 7-digit local numbers, spelled-out contacts, names and addresses pass. Content stays 7 days.                                                                                      | Keep the banner; add a 7-digit phone rule; document a manual takedown SQL in `docs/HISTORY-SETUP.md`; consider an explicit opt-in to save.                    |
| Med | CSP `script-src` allows `'unsafe-inline'` (`next.config.ts:9`). No HTML sink exists today (no `dangerouslySetInnerHTML`; markdown renders to React nodes with an href allowlist), so this is defence in depth only.                                                                | Move to nonce-based CSP when the pages can be dynamic; otherwise keep the documented trade-off.                                                               |
| Low | Hidden-character filter (`lib/validation.ts:15-16`) omits Unicode tag characters U+E0000–E007F (ASCII smuggling) and U+00AD, U+061C, U+180E, U+206A–206F, U+FFF9–FFFB.                                                                                                             | Extend the class with the `u` flag and add a test per range.                                                                                                  |
| Low | `lib/read-body.ts` has no try/catch around `reader.read()`; a mid-stream client abort becomes a framework 500 (noise, no leak).                                                                                                                                                    | Catch and return null.                                                                                                                                        |
| Low | Pre-commit hook blocks env files by name only and can be bypassed with `--no-verify`; CI has no secret scanning. Nothing sensitive is tracked today.                                                                                                                               | Add gitleaks or GitHub push protection.                                                                                                                       |
| Low | GitHub Actions pinned by tag (`actions/checkout@v4`, `actions/setup-node@v4`).                                                                                                                                                                                                     | Pin to SHAs; Dependabot keeps them fresh.                                                                                                                     |
| Low | `HISTORY_STORE=memory` is a runtime flag with no production guard (`lib/history.ts`). Never set on Vercel, but nothing stops it.                                                                                                                                                   | Refuse the memory store when `VERCEL_ENV=production`.                                                                                                         |
| Low | Per-client limiting depends on the host overwriting `x-real-ip`. Correct on Vercel; on another host the header could be rotated.                                                                                                                                                   | Keep the "deploy behind Vercel" note; the firewall rule is the backstop.                                                                                      |

Verified safe: the new `timeZone` field (string ≤64 chars that Intl accepts, else default, never
echoed or logged; the only text that reaches the prompt is a valid IANA name); logs hold numbers,
model name and error names only; purge auth uses `timingSafeEqual` and is idempotent; all SQL is
parameterised; roles are least privilege with a failing self-check; the e2e stub is refused in a
production build; no CORS headers and no cookies, so cross-origin POSTs are blocked by preflight.

Residual risk by design: prompt injection can still steer the model to a plausible wrong value
(address, name). Output is schema-bound, the model has no tools, and the dispatcher is the only
reader. The eval's injection cases and the "verify before dispatching" line are the mitigation.

## 3. Testing and specs

| Sev  | Finding                                                                                                                                                                                                                                                                                    | Fix                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High | The coverage floor is not enforced by `check`, the pre-commit hook or CI: `jest.config.mjs` sets `coverageThreshold` but `npm test` is plain `jest`, and `ci.yml` never runs `test:coverage`. CLAUDE.md and the Requirements page overstate this.                                          | Run `jest --coverage` in `check` (or a CI step). One-line change.                                                                                                 |
| High | The eval judge passes a critical case at 2 of 3 runs, and only re-runs after a first failure (`evals/score.ts`, `evals/parser.eval.ts`). A critical that invents a time 1 run in 3 passes; a flaky critical is only printed.                                                               | Criticals: always 3 runs, must pass all 3, flaky fails. Keep 2-of-3 for non-critical. The agent spec copies the current rule into its injection cases; fix first. |
| Med  | Real SQL is never executed: the Postgres store tests use a fake query and regex-match the SQL text. `make_interval`, `to_char`, the cap and migration idempotency are unproven in CI.                                                                                                      | Add a Postgres service job: run `db/schema.sql` twice, then `db/verify.sql`, then insert and list through the real store.                                         |
| Med  | Playwright runs against `npm run dev`; CI never runs `next build`. Dev CSP differs (`unsafe-eval`, no HSTS), so `e2e/security.spec.ts` does not test production headers, and a build-time failure (`lib/docs-source.ts`) only shows at deploy.                                             | Add a `next build` step; run e2e against `next start` in CI.                                                                                                      |
| Med  | Timing-dependent tests: `tests/usage-flow.test.tsx` measures real latency (it failed once during this session under load and passed alone); several route and page tests sleep 10–20 ms.                                                                                                   | Stub `performance.now` or inject meta; await the pending promises instead of sleeping.                                                                            |
| Med  | Date eval coverage gaps: "today" and "tonight", "day after tomorrow", a weekday said on that weekday, two dates in one note, "the 15th", a non-US "14/3", "Sun Valley Clinic" (the code comment admits the short-form weekday match clears the date), late-evening clocks.                 | Add cases; make one of them critical. Note the "past" and "too far" `notes` regexes mostly match code-written reasons, so `pickup_date: null` is the real check.  |
| Med  | The eval corpus is tidy: single sentences, about 8 recurring names, no dispatcher shorthand (`PU 0930 w/c`, `d/o`), no ALL CAPS, no typos, no contact numbers inside the note.                                                                                                             | Add 10–15 messy real-shaped notes (invented names).                                                                                                               |
| Med  | Requirements cannot be traced to tests: unnumbered PRD bullets, test titles unlinked.                                                                                                                                                                                                      | Give requirements IDs and put them in test titles; `lib/test-catalog.ts` will render them.                                                                        |
| Low  | `playwright.config.ts:17` reuses an existing server outside CI; a leftover dev server without the stub env would be reused silently _(hypothesis: could reach the paid API if a key is set)_.                                                                                              | Check the stub flag on the health endpoint before reuse, or always start a fresh server.                                                                          |
| Low  | The Tests page omits the ~140 Playwright tests (the catalog scans `app`, `components`, `lib`, `tests`, `evals`). No `.only` guard for Jest (`forbidOnly` exists only for Playwright). `ci.yml` has no `timeout-minutes` and uploads no e2e report on failure.                              | Extend the scanner; add `eslint-plugin-jest` `no-focused-tests`; add a timeout and artifact upload.                                                               |
| Low  | Spec housekeeping: `docs/superpowers/specs/2026-10-29-dispatch-agent-design.md` still says "draft, awaiting review", names `2026-10-29-agent.sql` (the real Phase 2 file is `2026-11-01-pickup-date.sql`; `source` and `draft_id` belong to Phase 3) and lists 3 date checks (code has 4). | Update the spec when Phase 3 starts.                                                                                                                              |

Fixed during this session from the audit: route tests for the time-zone wiring (zone reaches the
prompt, bad zone falls back with no echo, same note from two zones is two calls, same zone one
call); stale README and Requirements lines; the year-boundary date rule.

Hardest parts of the unbuilt spec to test, in order: the NDJSON stream contract and abort-stops-spending
(needs real streaming, not jsdom); budget reservation plus the agent gate under concurrency; the 60 s
deadline against 15 s steps with retries (fake timers plus `AbortSignal`); `ON CONFLICT DO NOTHING`
with INSERT-only privileges (needs real Postgres); the live "two Marias" and injection cases under a
stricter judge.

Strengths: 856 tests with the model always stubbed; pinned clocks everywhere; code validates the model
(dates, missing fields, lengths, enums); guard tests for repo hygiene, privacy claims, read-only
grants and docs matching config; route tests drive the real extract and validation; the e2e stub is
impossible in a production build.

## 4. Performance

No high findings. Build (Next 16.4.3, Turbopack): all docs, Requirements and Tests pages are static;
`/history` is partially prerendered; only `/api/parse` and the purge route are dynamic. 14 JS chunks,
788 KB on disk (largest 72 KB gzipped, probably the framework). 13 woff2 files across 3 font families.

| Sev | Finding                                                                                                                                                                                                                                                                                           | Fix                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Med | A History DB error is cached for 60 s: `loadCached()` in `components/HistorySection.tsx` wraps `loadHistory()`, which returns `{status:"error"}` instead of throwing, so `"use cache"` stores the error page. A Neon cold start shows "could not be loaded" for a minute.                         | Throw inside the cached function and catch in the component.                                                                           |
| Med | The 30 s upstream timeout (×2 with retry) is about 10× the real Haiku latency (1–3 s, estimate). During an upstream stall, 10 stuck calls hold every gate slot for up to 60 s and everyone else gets an instant 503.                                                                              | `UPSTREAM.timeoutMs` 10–12 s with 1 retry; `CLIENT.timeoutMs` is derived so it follows. This also matches the agent spec's 15 s steps. |
| Med | Limits multiply by instance count on Fluid compute (same root as the security finding). Fixed windows allow 2× the limit across a boundary.                                                                                                                                                       | Firewall rule first; shared store only if needed.                                                                                      |
| Low | Prompt caching is not used (no `cache_control`); the ~760-token prompt is probably under the cacheable minimum for Haiku-class models _(minimum not verified)_. The per-day "Today is …" line is at the end of the system prompt, so the prefix stays stable when caching is added for the agent. | Measure `cache_read` before claiming savings; keep the date line last or move it to the user turn.                                     |
| Low | Per-call setup that could be hoisted: `zodOutputFormat(ModelTripSchema)` rebuilt each call (`lib/extract.ts`), `Intl.DateTimeFormat` built per call in `lib/clock.ts`, a new store per save in `lib/history.ts`. Microseconds against seconds of model time.                                      | Hoist to module constants; memoize per zone and the store.                                                                             |
| Low | Limiter eviction is O(n) per new key once 10,000 keys are tracked (`lib/rate-limit.ts`). Only matters under a flood of unique IPs.                                                                                                                                                                | Evict by insertion order without the scan.                                                                                             |
| Low | Home page is wholly `"use client"` (`app/page.tsx`), Providers wrap every route, three Google font families with `adjustFontFallback: false` on two (build warns; possible swap shift). `validateNote` runs twice per keystroke.                                                                  | Server-render the static header and copy; add fallback metrics; one store selector per field.                                          |
| Low | History list renders up to 200 articles (~6k DOM nodes, ~100 KB HTML, estimate).                                                                                                                                                                                                                  | Cap at 50 with "show more" if it shows up on phones.                                                                                   |

Cost (tokens only; prices not checked): about 1,000–1,150 input and 160 output tokens per parse. A
demo at 1,000 parses a month is roughly 1.1M input and 0.16M output tokens. The theoretical per-instance
ceiling (300 calls/min) cannot be reached by any one client (3/min per IP). The API key spend cap is
the real ceiling and should be confirmed.

Done well: cheap checks before paid ones with instant 503s and no queueing; gate before budget;
reasoning off and `max_tokens` from a measured worst case; client timeout derived from the server's;
coalescer keeps nothing after completion and aborts when every waiter leaves; saves in `after()` with a
single atomic cap-plus-insert; History read cached and partially prerendered; docs pages static with a
build that fails on a missing source.

## 5. User experience, usability and accessibility

Contrast was computed from `app/globals.css`: every text colour passes AA (zinc-400 on panel 6.8:1,
amber 12.5:1, accent 8.3:1); borders pass the 3:1 non-text rule. Size, not contrast, is the issue:
labels are 11 px and chips and hints are 12 px.

| Sev  | Finding                                                                                                                                                                                                                                                                                    | Fix                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High | The card cannot be acted on: no copy, print or share (`components/TripCard.tsx`, `ResultPanel.tsx`). The dispatcher's next step is to move the data into a scheduling system; selecting across six `dl` cells is slow and near impossible on a phone.                                      | "Copy trip" as plain text (name, date, time, from, to, aids, notes), announced through the polite live region; then "Copy as JSON".                       |
| High | Focus and announcements: success only scrolls (`app/page.tsx:28-30`); errors use `role="alert"` but are not scrolled into view, so on a phone a rate-limit or out-of-credit message can sit below the fold and look like nothing happened. The whole card is read as one live-region dump. | Scroll the alert into view; move focus to the card heading (`tabIndex={-1}`) or announce a short status.                                                  |
| High | Staleness is a quiet hint: "The note has changed since this was parsed" is small text above a card that still looks current (`ResultPanel.tsx:25`); pressing Parse on an unchanged note does nothing visible (`app/page.tsx:72`).                                                          | Dim or outline the stale card with an "OUT OF DATE" tag in the header; announce "Already up to date" on the no-op.                                        |
| Med  | A date cleared by a check shows "Not stated" plus the reason buried in an unlabelled notes line, in ISO form ("Date 2026-10-01 has already passed"). It reads as "the note said nothing".                                                                                                  | Show the reason under the date field instead of the generic hint; label the notes line ("Parser note"); format dates in reasons with `formatDate`.        |
| Med  | Missing chips show raw field names (`pickup_time`, uppercased by CSS); underscores are read aloud by some screen readers.                                                                                                                                                                  | Map to the `COPY` field labels, or put the amber state on the empty field itself.                                                                         |
| Med  | Inconsistent "confirm" cues: date and mobility get an inline amber line; a missing pickup time (more dangerous) is a chip at the bottom below notes, the verify line and the usage line.                                                                                                   | One rule: inline hint under every "Not stated" value plus one summary line above the usage line.                                                          |
| Med  | The usage line ("123 in · 45 out · 812 ms") sits on every dispatcher's card, next to the safety reminder. Intended for reviewers (`PRODUCT.md`).                                                                                                                                           | Collapse into a `<details>` or "Details" toggle; keep the verify reminder last and most visible.                                                          |
| Med  | The 60-day window and cleared-date reasons do not say what to do; a standing order months out gets "not stated" with no way to enter the date.                                                                                                                                             | Add "add it to the record yourself" to the message; longer term, inline field editing.                                                                    |
| Med  | Mobility chips (the primary safety information) are the smallest text on the card: 12 px uppercase mono with wide tracking.                                                                                                                                                                | `text-sm` chips, heavier weight; raise `.lab` to 12 px.                                                                                                   |
| Med  | Pending state is only a skeleton; a slow call gives no "still working" message before the 65 s client timeout.                                                                                                                                                                             | After ~5 s show "Still working…"; on timeout offer Try again with the note preserved (it is).                                                             |
| Low  | Clear and "Use an example" discard a long note with no undo; the history notice sits between the form and result rather than by the textarea; the shortcut hint shows both Ctrl and ⌘; the jump nav links to an empty "Parsed trip" before any parse; Contact page carries install steps.  | Confirm or offer undo over ~100 chars; move the notice under the textarea; detect platform; hide the jump link until a result exists; move setup to Docs. |
| Low  | History formats saved-at times in UTC (labelled) while the card shows the dispatcher's local pickup time and date; disclosed but confusing.                                                                                                                                                | Show saved-at in the viewer's zone client-side, or label both.                                                                                            |

One audit hypothesis was wrong and is dropped: `app/error.tsx` uses the `retry` prop, which is what
the bundled Next 16 docs specify.

Usability features that work well: honest visible blanks ("Not stated" with a dashed underline, exposed
to screen readers); dates formatted in UTC with a weekday so they never shift; the browser zone makes
"tomorrow" the dispatcher's tomorrow; 12-hour display over 24-hour data; Ctrl/⌘+Enter with a
double-submit lock; unchanged notes are not re-sent; the note survives navigation (Zustand); the
counter counts what the server counts; mobility as plain-language chips; `role="alert"` errors, skip
link, 44 px targets, `motion-safe` animation, `aria-expanded` mobile menu with Escape handling.

Feature gaps, prioritised:

1. Copy trip to clipboard (text, then JSON or CSV). Without it the result has no path to the dispatch system.
2. Edit or correct a field in place, including a date outside the 60-day window.
3. Several trips in one note, and return trips ("to the clinic and back at 3").
4. Recent notes on this device (local storage, not public History); today a refresh loses everything.
5. Print or a one-page trip sheet.
6. A persistent out-of-date state on the card.
7. Contact or callback number capture (the card has no phone field; History scrubs numbers).
8. Spanish UI and date formatting (Spanish notes already pass the eval; `lang="en"` is fixed).
9. Light or high-contrast preference (dark only, `color-scheme: dark`).
10. A "still working" message and retry on slow or offline networks.

## 6. Priorities

Do before Phase 3 (agent route):

1. Enforce coverage in `check` or CI (one line).
2. Tighten the eval judge for critical cases (always 3 runs, all must pass); the agent evals inherit it.
3. Add a real-Postgres CI job and a production-build e2e run; Phase 3's `ON CONFLICT`, streaming and abort behaviour cannot be tested otherwise.
4. Fix the cached History error (`HistorySection.tsx`) and cut the upstream timeout to 10–12 s.
5. Add the Vercel Firewall rule on `/api/parse` and confirm the API key spend cap.

Do soon (product): Copy trip, inline hint for every missing field with readable names, stronger
stale state, cleared-date reason under the date field, usage line behind a toggle.

Later: nonce CSP, tag-character filter, secret scanning and SHA-pinned actions, messier eval corpus with
IDs tied to requirements, hoisted per-call setup, font fallback metrics.
