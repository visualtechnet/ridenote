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
  `null`" or "notes must mention _tomorrow_");
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
guess, an hour with no AM or PM is `null`, dates go in `notes`, several trips, text that is not a
trip) has a matching group of eval cases. `lib/prompt.test.ts` makes sure no rule is edited away by
accident; the eval tells you whether the model obeys it. Change the prompt, then run the eval.

**The schema.** `lib/trip.ts` defines the shape of a trip. `extractTrip` sends it to the model as a
structured-output format, which constrains the answer to the right keys and types, with
`mobility` a list limited to the known aids (wheelchair, cane, walker and so on). Some rules cannot be expressed that way (the `HH:MM` pattern and
the length limits), so the answer is checked again with the same schema after it arrives. The server
also recomputes `missing_fields` from the data rather than trusting the model's list. The eval scores
the result _after_ all of this, so it sees what a user would see. An answer that breaks a rule shows
up as a failed case.

**Validation.** `lib/validation.ts` is the front door: it decides which notes the API will accept.
Every eval note is checked against it in `evals/score.test.ts`, so the eval can never test a note a
user could not send. This caught a real problem while building it (see the FAQ): notes pasted from
email contain `Name <address>`, which the validator was refusing.

## Critical cases and the pass rate

A run passes only if **both** hold:

1. Every **critical** case passes. These are the ones where a wrong answer is dangerous: inventing a
   missing time, address or name; guessing AM or PM; losing a date; inventing a mobility aid the note does not name, or dropping one it does (for example, "a wheelchair, a cane or a walker" must give all three); following an
   instruction hidden inside a note.
2. At least 90% of all cases pass (`PASS_RATE_FLOOR` in `evals/cases.ts`).

The two rules exist because a model is not perfectly repeatable. A single flaky formatting case
should not stop a release. A pickup time the model keeps inventing should.

**Re-runs.** A model does not answer the same way every time, so one unlucky answer should not fail a
case. When a case fails, it is run twice more, and it passes if it passes at least two of its three runs.
A case that passed some runs and failed others is printed as `FLAKY`, so unreliability is reported, not
hidden. A case that fails most of its runs fails the eval.

## Running it

1. Put your key in `.env.local` as `ANTHROPIC_API_KEY`.
2. `npm run eval` (or `npm run eval:key` on a Mac, to use the key saved in the Keychain). It takes under a
   minute and costs a few cents.
3. Read the `FAIL` lines. Each names the case and what was expected against what came back.

**Run it once now and keep the result as your baseline.** After that, run it whenever you change
`lib/prompt.ts`, `lib/trip.ts` or the `MODEL` setting. Without a key it fails on purpose, so a skipped
eval cannot be mistaken for a passing one.

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
