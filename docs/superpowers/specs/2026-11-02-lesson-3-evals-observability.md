# Lesson 3 (Evals & Observability) on the parser: closing the gaps

Date: 2026-11-02. Status: confirmed statement of intent (interview with Mark, 2026-11-02).
Source lesson: `AI Learning 2026/AI Lesson 3 - Evals & Observability.pdf` (outside the repo).

## Statement of intent

- **Outcome:** Lesson 3's missing artefacts added to RideNote's existing eval and logging, with the
  pass rate recomputed on a harder set.
- **User:** Mark, and the hiring manager who reads the README.
- **Why now:** Phase 2 (dates) is complete and the review's "before Phase 3" list is cleared, so the
  parser is stable enough to measure and write up.
- **Success:** a README section "How I evaluated this" with the pass rate on the enlarged set, one
  before-and-after prompt change with numbers, a Haiku-versus-Sonnet comparison with pass rate, cost and
  latency, and one honest failure left unfixed. Plus a dated results file per eval run, a failure
  taxonomy from reading the outputs, and request ID and prompt version on the log line.
- **Constraint:** invented notes only, never real patient data; nothing personal in logs; spend limited
  to the eval runs themselves (cents on Haiku, under a dollar on Sonnet).
- **Out of scope:** the agent (design spec Phases 1, 3 and 4), the LLM-as-judge stretch, hosted tracing
  tools, and the rest of the review's "Later" list.

## What the lesson asks for and what the repo already has

| Lesson 3 item                                            | State before this work                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| Test set of 20 to 30 cases with expected output          | Done: 49 cases in `evals/cases.ts`, 26 critical, pass-rate floor 90% |
| Harness with a pass rate and failing checks listed       | Done: `evals/parser.eval.ts`, `evals/score.ts`                       |
| Binary pass/fail per case, code assertions               | Done                                                                 |
| Log model, tokens, latency, stop reason per call         | Done: `parse usage:` JSON line in `app/api/parse/route.ts`           |
| Request ID, timestamp and prompt version on the log line | **Missing**                                                          |
| Error analysis: open coding, then a failure taxonomy     | **Missing**                                                          |
| A dated, saved baseline per run                          | **Missing**: the runner only prints                                  |
| One prompt change recorded as before and after           | **Missing** as a record (the FAQ tells past stories only)            |
| Second model: pass rate, cost and latency side by side   | **Missing** (the docs say how, nobody has)                           |
| README "How I evaluated this" with one honest failure    | **Missing**                                                          |
| Harder cases, because 100% means the tests are too easy  | **Missing**: the set is tidy (review, 2026-11-01)                    |

## Decisions

- **Messier cases** are invented notes in the shapes the review named: dispatcher shorthand ("PU 0930
  w/c", "d/o"), ALL CAPS without punctuation, typos, two candidate addresses, a phone number or email
  inside the note, a pasted email with greeting and signature around the trip, return or second trips,
  and the date edge cases the review listed ("today", "tonight", "day after tomorrow", "the 15th", a
  weekday said on that weekday, "Sun Valley Clinic"). Each case carries tags naming its shapes.
- **Results files** are committed under `evals/results/` so a baseline is evidence anyone can open. They
  hold the invented notes' answers; that is fine, they are invented.
- **Prompt version** is a short hash of the system prompt text, computed in code, so it can never be
  forgotten when the prompt changes.
- **Second model** is Claude Sonnet 5.5 (`claude-sonnet-5-5`). It rejects `thinking: { type: "disabled" }`
  with a 400; the parser sends `{ type: "between_tools" }` to it instead, which turns thinking off there.
- **Prices** for cost figures come from the Claude API reference cached 2026-10-06: Haiku 5.5 $0.10 in /
  $0.50 out per million tokens; Sonnet 5.5 $2.00 / $10.00. They are written down with that date.
- **The prompt change** is chosen after the error analysis: it targets the largest failure category.
  Only one change is made, so the before-and-after numbers mean one thing.
