# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary audience: hiring managers and reviewers who open the public demo and judge the work. The use case on display is a transport dispatcher (paratransit / non-emergency rides) who receives trip requests as free-text notes. Real dispatcher adoption is not a current goal.

## Product Purpose

RideNote turns a dispatcher's free-text note into a structured trip record: passenger, pickup, dropoff, pickup time and mobility aids, shown as a card. Success is a visitor pasting a note, getting a correct card in seconds, and trusting what it shows.

## Positioning

It never guesses. Anything the note does not say is marked **Missing**, including mobility needs, rather than filled with a plausible value. A neighboring "LLM extracts fields from text" tool cannot truthfully claim this guarantee.

## Operating Context

Visitors use a public demo with no accounts. Input is a note up to 1,000 characters. Parsing calls the Claude API behind per-client rate limits, a shared monthly budget (about $5, fixed) and a 600-token answer cap. A History of parsed results is public, per the approved design in `docs/superpowers/specs/2026-10-27-history-design.md`.

## Capabilities and Constraints

- Parser page (`/`), Requirements, Docs (guide, FAQ, eval), Contact; History in progress.
- Stack: Next.js 16, React 19, Claude API, Zod, React Query, Zustand.
- Missing fields are never filled in; the UI must show absence as Missing, never a placeholder that looks like data.
- No accounts or login.
- When the shared budget is spent the API answers 503 `out_of_credit`; the UI shows "This demo has used up its AI budget". This state must read as a clear, expected message, not a generic error.
- Per project policy, the Contact page shows no dollar amount.

## Brand Commitments

Name: RideNote. Plain, direct copy about what the tool does and does not do. No further identity commitments recorded.

## Evidence on Hand

Real eval suite (`evals/`, `docs/EVAL.md`), unit and e2e tests, and written docs. No testimonials, customers or usage numbers exist; do not fabricate them.

## Product Principles

1. Honesty over completeness: showing Missing beats showing a guess.
2. The result card is the product; everything else supports trusting it.
3. A visitor should reach a first result without reading anything.
4. Limits (budget, rate, length) are explained plainly when hit, never hidden.
5. The craft of the build is itself part of what the demo shows.

## Accessibility & Inclusion

WCAG 2.2 AA is required. Dispatch is a context where users may be accessibility-minded; keep keyboard, screen reader and contrast behavior solid (see `e2e/a11y-results.spec.ts`).
