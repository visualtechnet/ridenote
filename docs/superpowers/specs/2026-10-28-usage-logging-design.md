# Per-call usage logging (short design)

## Intent and why

The course lesson says to log token usage from day one because Lesson 3 builds on it. RideNote keeps
usage server-side (correct for a public demo) but never records it, so cost per call cannot be
checked. Log one line per paid model call: tokens, stop reason, latency.

## Goals

- One server log line per paid model call with: model, input/output/cache-read/cache-write tokens,
  stop reason, upstream latency in ms.
- Logged on every outcome that reached the model, including refusals, `max_tokens` cut-offs and
  validation failures (they still cost money).
- The eval suite can read the same numbers (no log noise there).

## Non-goals / anti-goals

- No dollar estimate (price tables go stale; tokens + model are enough to compute it later).
- No developer panel, no storage, no new endpoint, nothing sent to the browser.
- Never log note text, trip content or anything user-supplied. Numbers, model name and stop reason only.

## Constraints

- Logging stays in the route, not in shared libs (existing convention).
- Calls that throw (timeout, network) have no `usage`; they keep the existing error-type log and get no usage line.
- Coalesced identical concurrent notes share one call, so logging in `callModel` counts each paid call once.

## Approaches

- **A (chosen):** `extractTrip` returns a `meta` object on every outcome; `callModel` logs it.
- B: log inside `extractTrip` (rejected: evals would log per case; logging in a shared lib).
- C: proxy-wrap the client in the route (rejected: indirection, no numbers for evals).

## Design

- `lib/extract.ts`: add `meta: CallMeta` (`model, inputTokens, outputTokens, cacheRead, cacheWrite,
stopReason, latencyMs`) to both arms of `Extraction`. Latency is timed around `client.messages.create` only (it switched from `parse`, which throws on a cut-off or invalid answer before `usage` can be read).
- `app/api/parse/route.ts`: `callModel` logs `console.info("parse usage:", meta)` after `extractTrip`
  returns.
- `lib/e2e-stub-client.ts`: stub responses carry fake `usage` so the path is exercised.
- `docs/FAQ.md` and the matching FAQ page text: "Server logs record an error type, plus token counts,
  stop reason and latency per model call." Check `tests/privacy-claims.test.ts` still holds.
- Tests (TDD): extract returns meta on success/refusal/max_tokens/invalid output; route logs one usage
  line with no note text; no usage line when the call throws.

## Left to the builder

Exact field names and log format (key=value vs object), as long as it is one line and numbers-only.

## Out of scope

Missing-fields chips stay amber: deliberate, consistent with the dark instrument-panel design.
