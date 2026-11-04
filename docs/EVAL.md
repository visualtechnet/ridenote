# The accuracy eval

RideNote's job is to read a messy dispatcher note and return the right trip. The ordinary tests prove
the app is _built_ correctly. The eval checks the part they cannot: whether the AI actually gets the
answer right.

## Why ordinary tests are not enough

Every Jest and Playwright test in this project replaces the AI with a stand-in that returns a fixed
answer. That is the right choice for tests (they are free, fast and repeatable), but it means they
prove the **plumbing**: validation runs, errors become friendly messages, limits hold. They say
nothing about whether "at 9" turns into 09:00, 21:00 or `null`.

An **eval** is a test for a system whose answer cannot be written down in advance. You keep a set of
realistic inputs with a description of what a good answer looks like, run the real system on them,
and score the results. Where a unit test gives pass or fail on one fact, an eval gives a **pass
rate** across many, plus a short list of cases that must never fail.

## What it is

A set of example notes in `evals/cases.ts`. Each one has:

- a **note**, written the way a dispatcher would write it;
- an **expectation**: only the fields that matter for that case (for example, "pickup time must be
  `null`" or "pickup date must be `2026-11-03`");
- an optional **critical** flag, for answers a dispatcher could act on and be wrong about.

`npm run eval` sends every note to the real model, scores each answer, and prints what failed.

## Where it lives

- `evals/cases.ts`: the example notes and what each should produce. This is the file you edit.
- `evals/score.ts`: compares an answer with its expectation, and works out the pass rate.
- `evals/parser.eval.ts`: the runner that calls the real model. Not part of `npm test`.
- `evals/score.test.ts`: ordinary tests for the scoring code and the case list. These run in `npm test`
  and cost nothing.
- `jest.eval.config.mjs`: the separate Jest setup the eval uses.
- `lib/extract.ts`: the model call itself, shared with the API route. See below.

## How it connects to the rest of the app

The eval is only worth trusting if it exercises the same things users hit. It reuses four parts of
the app instead of copying them.

**The model.** The API route used to contain the model call. It now lives in `lib/extract.ts`
(`extractTrip`), and both the route and the eval call it. It reads the `MODEL` environment variable
exactly as production does, so `MODEL=<another model> npm run eval` is how you compare models: same
cases, different answers, a number to compare.

**The prompt.** `lib/prompt.ts` holds the instructions given to the model. Each rule in it (never
guess, an hour with no AM or PM is `null`, dates resolve to `pickup_date` against a pinned clock, several trips, text that is not a
trip) has a matching group of eval cases. `lib/prompt.test.ts` makes sure no rule is edited away by
accident; the eval tells you whether the model obeys it. Change the prompt, then run the eval.

**The clock.** Every case runs with a pinned clock (`CLOCK` in `evals/cases.ts`: Monday 2026-11-02 in New
York), so a case written around "tomorrow" never breaks the next day. The model is told that date as
"today". Code then checks the date it returns: it must be real, within 60 days, and on the weekday the
note names. The date cases cover "tomorrow", a weekday name, "next Friday", an explicit date, a date with
no time, no date, "morning" only, a past date, a date more than 60 days out, and a weekday that disagrees
with the date.

**The schema.** `lib/trip.ts` defines the shape of a trip. `extractTrip` sends it to the model as a
structured-output format, which constrains the answer to the right keys and types, with
`mobility` a list limited to the known aids (wheelchair, cane, walker and so on). Some rules cannot be expressed that way (the `HH:MM` pattern and
the length limits), so the answer is checked again with the same schema after it arrives. The server
also computes `missing_fields` itself (the model is not even asked for it), including the mobility flag, which unit tests cover rather than the eval. The eval scores
the result _after_ all of this, so it sees what a user would see. An answer that breaks a rule shows
up as a failed case.

**Validation.** `lib/validation.ts` is the front door: it decides which notes the API will accept.
Every eval note is checked against it in `evals/score.test.ts`, so the eval can never test a note a
user could not send. This caught a real problem while building it (see the FAQ): notes pasted from
email contain `Name <address>`, which the validator was refusing.

## Critical cases and the pass rate

A run passes only if **both** hold:

1. Every **critical** case passes. These are the ones where a wrong answer is dangerous: inventing a
   missing time, address or name; guessing AM or PM; converting a time between time zones; losing a date; inventing a mobility aid the note does not name, or dropping one it does (for example, "a wheelchair, a cane or a walker" must give all three); following an
   instruction hidden inside a note.
2. At least 90% of all cases pass (`PASS_RATE_FLOOR` in `evals/cases.ts`).

The two rules exist because a model is not perfectly repeatable. A single flaky formatting case
should not stop a release. A pickup time the model keeps inventing should.

**Re-runs.** A model does not answer the same way every time, so one unlucky answer should not fail an
ordinary case. When such a case fails, it is run twice more, and it passes if it passes at least two of
its three runs. A case that passed some runs and failed others is printed as `FLAKY`, so unreliability is
reported, not hidden. A case that fails most of its runs fails the eval.

**Critical cases are stricter.** A critical case is always run three times, whether or not the first run
passed, and it must pass all three. One wrong answer in three is one wrong trip in three, so a flaky
critical is a failure, not a warning. This makes the eval slower and a little dearer (about three times the
calls for the critical cases), which is the point: the cases that matter are measured, not sampled. A request that throws (for example an answer the
SDK cannot parse) counts as one failed attempt for that case, so one broken request cannot stop the run
and hide every other result.

## Running it

1. Put your key in `.env.local` as `ANTHROPIC_API_KEY`.
2. `npm run eval` (or `npm run eval:key` on a Mac, to use the key saved in the Keychain). It takes under a
   minute and costs a few cents.
3. Read the `FAIL` lines. Each names the case and what was expected against what came back.

**Run it once now and keep the result as your baseline.** After that, run it whenever you change
`lib/prompt.ts`, `lib/trip.ts` or the `MODEL` setting. Without a key it fails on purpose, so a skipped
eval cannot be mistaken for a passing one.

## Results files and baselines

Every run writes one file to `evals/results/`, named `<date>-<model>[-<label>].json`, and the files are
committed. The lesson behind this is simple: a pass rate you remember is an anecdote; a pass rate in a
dated file next to the prompt version that produced it is evidence anyone can open and rerun. A file
holds a summary (cases, passed, pass rate, critical failures, tokens, cost, calls made, latency per call
and per case) and then one row per case: its verdict, the problems found, the model's last answer, and
what that case's attempts cost. The answers are kept because every note is invented; reading them is
how the error analysis below was done.

- `EVAL_LABEL=before npm run eval` adds a label to the file name, so the runs around a prompt change
  sit side by side (`-before`, `-after`).
- `MODEL=claude-sonnet-5-5 npm run eval` writes a file for that model, so two models can be compared
  on the same cases and the same prompt version.
- Cost is computed from the token counts with the list prices in `evals/prices.ts`, taken on the date
  in `PRICES_AS_OF`. The bill is the truth; this is the estimate.
- The prompt version in the file is `PROMPT_VERSION` from `lib/prompt.ts`, a hash of the prompt text,
  so a file can never be mistaken for a run on a different prompt.

## Error analysis

Lesson 3's rule is to look at outputs before building anything: collect the answers, write one line on
the first thing wrong with each (open coding), group the lines into categories and count them (axial
coding), then fix the biggest category in the prompt and build automated checks only for what persists.
`evals/ERROR-ANALYSIS.md` holds the full pass on the messier set, done 2026-11-02 against
`evals/results/2026-11-02-claude-haiku-5-5-before.json` (73 of 76). The categories it found:

| Category                                                                                    | Count          |
| ------------------------------------------------------------------------------------------- | -------------- |
| A stated time returned as `null` because the model doubted something else (day, which trip) | 2 (1 critical) |
| Code clears a real date because a place name contains a weekday abbreviation ("Sun Valley") | 1              |
| A shorthand marker left inside a field ("d/o main ent")                                     | 1 (passed)     |
| A second trip understood but phrased as uncertain                                           | 1 (passed)     |

The first category was the target of the one prompt change recorded in the same file; the second is a
known limit of `lib/dates.ts`, kept as an honest failure.

## Comparing models

`MODEL=<id> npm run eval` runs the same cases and prompt on another model and writes its own results
file, so two models can be set side by side. Done on 2026-11-02 for Haiku 5.5 against Sonnet 5.5
(prices from `evals/prices.ts`, list rates as of 2026-10-06):

| Model               | Passed   | Pass rate | Critical failures | Mean ms per call | Median ms per case | Tokens per case (in / out, all attempts) | Cost per case (all attempts) | Cost per 1,000 single parses |
| ------------------- | -------- | --------- | ----------------- | ---------------- | ------------------ | ---------------------------------------- | ---------------------------- | ---------------------------- |
| `claude-haiku-5-5`  | 73 of 76 | 96%       | 0                 | 1540             | 1990               | 4416 / 236                               | $0.0006                      | $0.29                        |
| `claude-sonnet-5-5` | 72 of 76 | 95%       | 1                 | 1693             | 2464               | 4416 / 212                               | $0.0110                      | $5.63                        |

Same 76 cases, same prompt `9cd5b85e`, same judge (criticals three times, must pass all three), the same
day. "Per case" counts every attempt a case made; "per 1,000 single parses" is what one parse costs
at list price, times a thousand, since a user's request is one call.

Sonnet failed where Haiku passed: shorthand: STR means stretcher; typos: vowels dropped in a hurry; contact detail: a phone number to call first is not an address. Haiku failed where Sonnet passed:
'next Friday' is a Friday (this week's or the week after are both fair); second trip: two passengers in one note; the first is captured, the second is flagged. Both fail Sun Valley Clinic, which is cleared in code, not by the model.
The whole run cost $0.83 on Sonnet against $0.04 on Haiku, a ratio of 20.

Decision: the bigger model lost a case, one of them critical (it returned no passenger name for the
note with a phone number in it), for about 20 times the cost and no latency gain. RideNote keeps Haiku 5.5.
Files: `evals/results/2026-11-02-claude-haiku-5-5-after.json`, `evals/results/2026-11-02-claude-sonnet-5-5-after.json`.

## Adding a case

Add an entry to `CASES` in `evals/cases.ts`. Good sources are real notes (with names changed) and
real failures. Every wrong answer found in use should become a case, so the same mistake is caught
next time. Check only what matters: the fewer fields an expectation names, the less likely it is to
fail for a harmless reason. Mark a case `critical` only when a wrong answer could send a vehicle to
the wrong place. Then run `npm test`, which confirms the note is one the API would accept.

## What the eval does not do

- It does not make the model deterministic. The same note can score differently on two runs, so
  look at patterns, not single results.
- It samples. A pass rate over a few dozen notes is a smoke alarm, not a guarantee.
- Wording checks on `notes` are loose patterns. A correct answer phrased unexpectedly can fail; widen
  the pattern when that happens.
- It costs money, so CI does not run it. Run it yourself before changing the prompt or model.
- It tests the parser, not the screen. The browser tests cover the screen.

## What building it taught us

The bugs and mistakes found along the way are written up in the [FAQ](FAQ.md), numbered from 23.
The short version: tests with a stand-in AI cannot tell you the AI is right; a rule you do not state
in the prompt is a rule the model may guess at; and a check that can be skipped silently is not a
check.
