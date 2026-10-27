# FAQ, and what went wrong along the way

This page has two parts.

1. **[Questions people ask](#part-1-questions-people-ask)**: how to use and run the project.
2. **[Mistakes and bugs, and what they taught us](#part-2-mistakes-and-bugs-and-what-they-taught-us)**:
   real problems found while building this, including mistakes made by the assistant that wrote much
   of the code. They are written down on purpose. A bug you have read about is a bug you will
   recognise in your own code.

---

# Part 1: Questions people ask

### How do I run it?

`npm install`, copy `.env.example` to `.env.local`, add your `ANTHROPIC_API_KEY`, then `npm run dev`.
Full steps are in the [README](../README.md).

### What should I type into the parser?

Write it the way a dispatcher naturally would: who, where from, where to, when, and mobility. The
**Docs** page in the site lists 13 notes that work and 13 that are refused, with the reason for each.

### Why did my note come back with "Missing" fields?

Because the note did not say those things. The parser never guesses: an unstated value is `null` and
is listed under Missing. Missing is a successful result, not an error.

### My address has no state. Will it fail?

No. Locations are free text, not city/state/zip columns. Whatever you wrote is kept as written.

### Why is `<` sometimes refused?

The validator blocks HTML and script text. The rule is "`<` followed by a letter, `/`, `!` or `?`"
(plus whitespace before those). So `<b>Lee</b>` is refused, but `ETA < 10 minutes` and `5 <3` are fine, and so is an email address in angle brackets such as `Dana <dana@clinic.org>`.

### What is the difference between a 400 and a 502?

- **400** means _your request_ was wrong (bad JSON, or a note that fails a rule). Fix it and resend.
- **502** means _our side or the AI_ failed. Nothing is wrong with your note. Try again.

The Docs page explains 400, 404, 405, 413, 415, 422, 429, 500, 502 and 503.

### What does 429 mean, and what does 503 mean? They both say "try later".

- **429**: _you_ sent too many requests (10 per minute per client). The `Retry-After` header says when.
- **503**: _everyone together_ is using too much (the shared AI budget or the simultaneous-call cap).
  It protects cost and the server. It is not about you in particular.

### Does the app store my notes?

No. Notes go to the AI service to be parsed and are not saved by this app. Server logs record only
an error _type_, never the note, because notes contain personal details. Use fictional names in
examples, tests and bug reports.

### Why do two people sending the same note at the same moment cost one AI call?

On purpose. Identical concurrent requests share one call (`lib/coalesce.ts`). Nothing is kept
afterwards. A longer-lived cache was deliberately not added because it would hold passenger details
in memory. Decide that with a privacy review first.

### Why does pressing Parse twice on the same note do nothing?

The result on screen is already the answer for that exact note, and every call costs money. Edit the
note and Parse again, or press Clear.

### Why does the rate limit behave oddly on my machine?

With no proxy headers (local `npm run dev`), every client looks identical and shares one bucket.
Hosts such as Vercel set `x-real-ip`, so each visitor gets their own. Also, counters live in memory,
so on serverless hosting each instance counts separately. See [SCALING.md](SCALING.md).

### Can I change the limits?

Yes, in `lib/config.ts` only. If you raise `LIMITS.noteMax`, raise `LIMITS.bodyMaxBytes` too (body =
6 x note length + 100, rounded up). Run `npm test`; the tests are written against the constants, so
they follow the change.

### Why does the Tests page show a count? Where does it come from?

`lib/test-catalog.ts` reads the real `*.test.ts(x)` files when the site is built and lists their
`describe` and `it` names. It reads names only, never test code. It cannot drift from reality.

### The Tests page build fails with "No test files found".

The build is running somewhere the source files are not present (for example a stripped container).
The failure is deliberate: better to refuse to build than to publish "0 tests". Build where the
source tree exists.

### What does `npm run dev:key` do, and why not just `npm run dev`?

Both start the app. `dev:key` first looks for your Anthropic API key in the Mac Keychain. The first
time, it asks you to paste the key and saves it there, so you are never asked again and no file holds
the key. Plain `npm run dev` reads the key from a `.env.local` file instead, which also works on
Windows and Linux. If `dev:key` says it only works on a Mac, use `.env.local`. To check, replace or
delete the saved key, use `npm run key:status`, `npm run key:set` and `npm run key:remove`.

### Why does the card say 9:30 AM when the API returns 09:30?

On purpose. The data stays 24-hour (`09:30`, `15:00`, `23:59`) with no AM or PM: that form cannot be
misread, sorts correctly as text, and suits a database. The card converts it to 12-hour (9:30 AM,
3:00 PM) only for people to read. The exact value is still on the page, in the `datetime` attribute of
the `<time>` element. A plain function does the conversion, so there is nothing for the AI to get wrong.

### Does it convert time zones?

No. The time is exactly what the note says. It is never converted to the server's time or to any other
zone. If the note says "3pm EST", the result is `15:00` and the zone is only repeated in `notes`, so a
person can see it. There is no date field either; days and dates are repeated in `notes`.

### What does "Not stated" mean for mobility? What happened to "Unknown"?

Earlier versions showed "Unknown" for mobility. That one word meant two different things: the note said
nothing about it, or the note said something the single value could not hold (for example three aids).
Now `[]` means only "the note did not say", and the card shows "Not stated". If the note names aids,
every one is listed. If the note is vague ("needs a hand") or unclear (it is not clear whether she uses
all of them or one), the list holds what was named and the `notes` line explains the doubt.

### Why is mobility a list?

A passenger can use more than one aid, and a note can name several ("a wheelchair, a cane or a walker").
`mobility` is a list of every aid the note names: `wheelchair`, `stretcher`, `walker`, `cane`,
`crutches`, `scooter` or `other`. `["ambulatory"]` means walks unaided, and `[]` means the note did not
say. The AI sorts plain words into these categories (a rollator is a walker, a gurney is a stretcher).

### What is the eval, and when do I run it?

A live accuracy check: about thirty realistic notes are sent to the real AI and the answers are
scored. Run `npm run eval` after changing `lib/prompt.ts`, `lib/trip.ts` or the `MODEL` setting, and
once now to record a baseline. It needs your API key and costs a few cents. The Eval page explains
how it works.

### Why is the eval not part of `npm test` or CI?

Because it spends money and its answers vary slightly between runs. Tests that run on every commit
must be free and repeatable, so they use a stand-in AI. The eval is the opposite trade: real answers,
run on purpose.

### The eval fails with "ANTHROPIC_API_KEY is not set".

That is intended. A skipped eval looks the same as a passing one, so with no key it fails loudly.
Add the key to `.env.local` and run it again.

### The eval failed on one case. Is the app broken?

Read the `FAIL` line first. If a **critical** case failed, treat it as a real problem: the model
guessed something it should have left empty. If a non-critical case failed, check whether the
expectation was too strict (a correct answer worded differently) before changing the prompt.

### I am a manager and just want to see it. Do I need an API key?

Not if you use the public demo: open the link and click Parse. It runs on a small, fixed budget of
about $5 a month for everyone together, and that limit is not raised, so it can run out. To run it on
your own computer you **do** need your own Anthropic API key, created in your own account. API keys
are not provided or shared. The README and the Setup page have the steps.

### It says "This demo has used up its AI budget". What now?

The demo's fixed monthly limit is spent. It stays unavailable until the limit renews, and it is not
raised on request. To keep going, run RideNote yourself: clone the repository, create your own key in
your Anthropic account, put it in `.env.local` (or run `npm run dev:key` on a Mac), and start it.

### How do I deploy it to Vercel?

The README has a step-by-step "Deploying to Vercel" section. The short version: import the repository,
add `ANTHROPIC_API_KEY` as a Production-only, Sensitive variable using the demo key, and deploy. A
changed variable only applies to new deployments, so redeploy after changing it.

### Is it safe to leave the public demo running?

The most it can cost is the spend limit on the demo's API key, because the key has a small fixed cap.
The code adds per-client and shared limits, input checks, and strict handling of the AI's answer. The
key is never in the repository or sent to the browser. `SECURITY.md` lists what is protected and the
known limits, such as the in-memory rate limiter counting per server instance.

### Is this safe for the AI part? What about prompt injection?

Several layers: notes with markup or hidden characters are refused; angle brackets are escaped
before the note is placed inside `<note>` tags; the system prompt says everything inside is data,
never instructions; and the AI's answer is validated against a strict schema again before it
reaches the browser. `missing_fields` is computed by the server from the nulls, so a manipulated
answer cannot misreport it.

---

# Part 2: Mistakes and bugs, and what they taught us

Each entry says **what happened**, **why**, **how it was caught**, and **the lesson**. Where the
assistant made the mistake, it says so.

## Bugs in the code

### 1. The "hidden characters" check could be dodged by the trim step

**What happened.** The validator rejects invisible characters such as a byte order mark (U+FEFF) and
line separators (U+2028). But the note was trimmed _before_ the check, and JavaScript's `trim()`
treats those characters as whitespace. A note that started with U+FEFF had it silently deleted,
then passed.

**Caught by.** A new test that fed a leading U+FEFF to the validator. It failed.

**Fix.** A small `trimOrdinary` that trims normal whitespace but leaves those characters in place
so the check can see them. The form's character counter uses the same function.

**Lesson.** _Order of operations is part of security._ A "clean up" step that runs before validation
can erase the very thing you wanted to reject. Validate the raw input, or make sure cleanup cannot
remove evidence. And: write a test for every character class you claim to block.

### 2. The rate limiter reset itself when its table was full

**What happened.** `lib/rate-limit.ts` makes room for new clients by deleting old entries once it
tracks too many. The code ran that cleanup _before_ checking whether the current key already existed.
With a table size of 1 (used for the shared budget), every call deleted its own counter, so the limit
never triggered.

**Caught by.** The first test of the shared budget: it expected a 503 and got 200. The limiter's own
tests had never used a table size small enough to hit this.

**Fix.** Only make room for a key you have not seen. A regression test pins it.

**Lesson.** _Test the boundary of every limit, including the unusual settings._ The bug was invisible
at the default size (10,000) and obvious at size 1. Also: "it passed all its tests" only means the
tests did not look there.

### 3. The body-size limit still let the whole body be read first

**What happened.** The API checked `Content-Length` and then called `req.text()`, which reads the
entire body into memory _before_ checking its real size. A client that omitted or lied about
`Content-Length` could make the server buffer a huge upload. The 16 KB cap did not bound memory.

**Caught by.** An automated code review.

**Fix.** `lib/read-body.ts` reads the body as a stream and stops the moment it passes the limit.

**Lesson.** _A header is a claim, not a fact._ Enforce limits on the bytes you actually receive, as
you receive them.

### 4. Pressing Parse twice quickly sent two paid requests

**What happened.** The Parse button is disabled while a request runs, so it looked protected. But
"disabled" only takes effect after React re-renders, and a very fast double click lands before that.

**Caught by.** An end-to-end test that double-clicks. A unit test alone would not have found it,
because the unit test clicked one step at a time.

**Fix.** A `useRef` flag set _synchronously_ in the click handler is the real lock. The disabled
button is just the visual hint. A test fires two clicks in the same instant, and was checked by
removing the lock and watching the test fail.

**Lesson.** _A disabled button is a hint, not a lock._ State that is updated by React is asynchronous;
a lock must be synchronous. Also: a test you have never seen fail is a test you cannot trust, so
break the code on purpose once.

### 5. A validation error could make the Parse click silently miss

**What happened.** Type an invalid note, click Parse. On mouse-down the text box loses focus, which
reveals the error message _above_ the buttons. That pushes the Parse button down, away from the
pointer, so the click never lands and nothing seems to happen.

**Caught by.** An end-to-end test that clicked Parse after typing markup. Only the cases with longer
messages failed, which fits the explanation that a bigger shift moves the button further. That
explanation was inferred from the pattern and confirmed only by the fix working.

**Fix.** The error message now sits _below_ the button row, so it cannot move the buttons.

**Lesson.** _Layout shifts break clicks._ Anything that appears between the user's pointer and their
target moves the target. Put late-appearing content where it cannot push controls. Real browsers
find bugs that simulated ones cannot.

### 6. Long text overflowed the card on a phone

**What happened.** A very long unbroken name or address pushed the page wider than a 320 px phone.
`break-words` was already on the text. It was not enough.

**Why.** Flex and grid children have an automatic minimum width equal to their content. Text cannot
shrink below that unless the child also has `min-w-0`. The notes paragraph also had no
`break-words` at all, and the Tests page file names had none either.

**Caught by.** An end-to-end test with 250-character values at 320 px wide, plus a probe that listed
which elements ran past the screen edge.

**Lesson.** _In flexbox and grid, `min-width: 0` is the answer to "why won't this shrink"._ And test
layout with hostile data (very long, no spaces), not just friendly data.

### 7. The character counter and the validator disagreed

**What happened.** The counter showed the raw typed length; the validator trims and normalises
first. Twenty trailing spaces on a 990-character note showed "over the limit" while the server would
have accepted it.

**Lesson.** _Show the user the number the system actually uses._ One definition of "length", shared.

### 8. A result could stay on screen for a note that had changed

**What happened.** Parse a note, edit it, and the old card stayed with no hint it was out of date.

**Fix.** The card now says "The note has changed since this was parsed" when the text no longer
matches what was parsed.

**Lesson.** _Derived data should say when it is stale._ It is cheap to compare, and costly to
dispatch the wrong ride.

### 9. The browser had no timeout and ignored `Retry-After`

**What happened.** The page could wait forever on a hung request, and a 429 told people "you're going
a bit fast" with no wait time even though the server knew it.

**Fix.** A browser timeout slightly longer than the server's own worst case, and the message now
says "wait N seconds" when `Retry-After` is present.

**Lesson.** _Every network call needs a timeout, and information the server sends should reach the
person._

### 10. A cancelled request was logged as a failure

**What happened.** When someone closed the tab mid-request, the abort was caught as a generic error,
logged as "parse failed" and answered with a 502 nobody received. Monitoring would have shown phantom
upstream failures.

**Fix.** If the client has gone, answer quietly (499) and log nothing.

**Lesson.** _Separate "the user left" from "something broke"._ Noisy logs hide real problems.

### 11. HSTS applied to localhost and to sibling subdomains

**What happened.** The security header `Strict-Transport-Security` was sent in development with
`includeSubDomains`. That can pin `localhost` to HTTPS in your browser, and can break any plain-HTTP
service on a sibling subdomain for up to two years.

**Fix.** Production only, and without `includeSubDomains`.

**Lesson.** _Security headers have side effects that outlast the page._ Understand each one before
turning it on, especially the ones browsers remember.

## Design mistakes

### 12. Hardcoded numbers in the tests

**What happened.** Several tests said `"2001 / 2000"` and `"a".repeat(2001)`. When the limit changed
to 1,000 they broke, even though the code was right. The project's own rule is "numbers live in
`config.ts`", and the tests had quietly broken it.

**Fix.** Tests read `LIMITS.noteMax` like everything else.

**Lesson.** _The rule against hardcoding applies to tests too._ A test with a magic number is a
second copy of the number, which will drift.

### 13. Spending the shared budget on requests that were turned away

**What happened.** The first version of the AI-call guard checked the shared budget _before_ the
simultaneous-call gate. A request refused at the gate had already used up a unit of the budget.

**Caught by.** A test that counted calls exactly.

**Fix.** Gate first, budget second, and give the gate slot back if the budget refuses.

**Lesson.** _Only charge for work that happens._ When several limits stack, order them so a refusal
at one does not consume another.

### 14. The first answer-size cap was too tight

**What happened.** `max_tokens` was first lowered to 400 to save money. Working out the worst case
from the schema limits (a 200-character name, two 300-character locations, a 300-character note) showed
a legitimate answer could exceed that and be cut off, which would show as a mysterious 502.

**Fix.** 600, with a comment saying why.

**Lesson.** _A cost cap must sit above the legitimate worst case._ Derive it from the schema, not
from a feeling.

### 15. The Tests page reads the file system

**What happened.** The page lists tests by reading source files at build time. Two risks: the bundler
warned that it would trace the whole project into the deployment, and on a build without the sources
the page would silently say "0 tests".

**Fix.** The path is explicitly excluded from tracing, and an empty result now fails the build.

**Lesson.** _Code that depends on files existing at runtime needs to fail loudly when they do not._
A confident wrong answer is worse than a crash.

### 16. A change to the page broke a test the assistant did not run

**What happened.** Adding the site header put two new stops in the keyboard tab order (brand link,
menu button). The keyboard e2e test expected the text box right after the skip link and failed. The
assistant had run the unit tests but not the browser tests after changing the layout, so the
failure surfaced one round later.

**Lesson.** _Run the slow test suite after any change to the thing it tests._ Fast tests passing
does not mean the whole system works. Here a browser test caught what jsdom cannot.

### 17. Re-parsing the same note was a tested behaviour, then deliberately changed

**What happened.** An old test asserted that pressing Parse again re-sent the request. When we stopped
paying for identical re-parses, that test failed.

**Lesson.** _When a test fails after an intentional change, change the test on purpose, and say why._
The test was right about the old behaviour. It was updated to assert the new rule (edit the note, then
it re-sends), not deleted or loosened.

## Mistakes in understanding, tooling and review

### 18. Reading a review finding too literally (and not literally enough)

**What happened.** An automated review claimed that notes like `Pickup <John Smith>` or `ETA <5 min`
were wrongly rejected. Reading the regex showed `<5` is fine, because a letter or `/ ! ?` must follow
the `<`. The reviewer's text had HTML-escaped the `<` symbols, which made the examples confusing. But
the review was partly right: `x < a` _is_ rejected, because whitespace is allowed before the letter.
That is a minor false positive and was left as is, with the rule documented.

**Lesson.** _Check a finding against the code before acting, in both directions._ Reviews, human or
automated, are often half right. Do not dismiss the whole finding because part of it is wrong.

### 19. Editing files with tools that behave differently on macOS

**What happened.** Several commands failed for platform reasons: `sed -i` needs a different
form on macOS (BSD `sed`), the `timeout` command does not exist, and a shell redirect path in `/tmp`
went against the project's scratch-directory rule.

**Lesson.** _Shell commands are not portable._ For repeatable edits, prefer a script in a language you
control, or the editor's own tools. When a command "silently" does nothing, check that it actually
ran.

### 20. Invisible characters in source code

**What happened.** The hidden-character regex had literal invisible characters pasted into the source
file. They looked like nothing, were impossible to review, and a scripted edit corrupted them,
producing confusing TypeScript syntax errors.

**Fix.** Rewrite the regex with explicit `\uXXXX` escapes, so every character is visible and
reviewable.

**Lesson.** _Never put characters you cannot see into source code._ Use escapes. If a reviewer cannot
read it, it is not reviewed.

### 21. Test helpers that were not safe to run in parallel

**What happened.** The end-to-end helper that gave each test a unique client address used a plain
counter. Playwright runs tests in several worker processes, each with its own counter, so two workers
produced the same address, shared a rate-limit bucket, and one test failed randomly.

**Fix.** Random bytes instead of a counter.

**Lesson.** _A counter is not unique across processes._ When tests run in parallel, shared state must
come from something truly unique (random values, process ids), and "it passed when run alone" is a
warning sign, not good news.

### 22. `instanceof Error` is not reliable across environments

**What happened.** The client checked `err instanceof Error` to detect a timeout. A `DOMException`
created in the test's Node environment is not an `Error` from the same realm, so the check failed and
the timeout message never appeared.

**Fix.** Check the error's `name` property.

**Lesson.** _`instanceof` can lie when code crosses realms_ (iframes, test sandboxes, workers). For
errors, checking `.name` is more robust.

## Mistakes found while hardening the parser

These came from a deliberate review of the requirements, and from building the eval.

### 23. Pasted emails were refused as "markup"

**What happened.** The "no HTML" rule refused any `<` followed by a letter. Dispatchers paste from
email, where a sender looks like `Dana <dana@clinic.org>`. That note was rejected with a message about
scripts. The rule protected nothing here: the note is escaped before the AI sees it, and the page
shows everything as text.

**Caught by.** Running real-looking notes through the validator during the review, not by any
existing test (they only contained attacks).

**Fix.** A strict email-in-brackets shape (no spaces, no quotes, so it cannot carry attributes) is
set aside before the tag check. Real tags and `javascript:` links are still refused, and tests prove
both directions.

**Lesson.** _A security rule needs tests for who it wrongly blocks, not only who it stops._ Write the
"this normal input must pass" case next to every "this attack must fail" case.

### 24. The Requirements page listed fewer statuses than the API returns

**What happened.** The page named 400, 413, 422, 429 and 502 but not 415 or 503, while the API
returns both and the README listed them.

**Fix.** The list now includes them, and a test checks every status constant against the page.

**Lesson.** _Anything written twice will drift._ Where a fact lives in code, make the document check
it against the code.

### 25. A count in the docs was out of date within hours

**What happened.** Adding one example made "12 accepted examples" wrong in the README, and the FAQ
still said 12 after the README was fixed.

**Fix.** A test reads the README and the FAQ and compares their counts with the real example lists.

**Lesson.** _A hardcoded number in prose is a future bug._ Either generate it or test it.

### 26. Every test used a stand-in AI, so nothing checked the answers

**What happened.** The project had hundreds of passing tests and 100% coverage, yet no test ever
asked whether "at 9" produces a sensible time. The stand-in AI returns whatever the test tells it to,
so those tests cover the code around the AI and not the AI.

**Fix.** The eval: realistic notes, the real model, scored answers, with a pass rate and a list of
cases that must never fail.

**Lesson.** _Coverage measures lines run, not questions answered._ When a component is
non-deterministic, you need a different kind of test for it, and it will not be free.

### 27. The prompt left risky cases to chance

**What happened.** The instructions said "use only stated facts" but nothing about an hour with no
AM or PM, a date like "tomorrow" (there is no date field, so it was silently dropped), several trips
in one note, a note with no trip, or unclear mobility such as a walker (mobility has since become a
list of aids, see #34).

**Fix.** Each case now has an explicit rule: unsure means `null` plus a reason in `notes`. Each rule
is pinned by a prompt test and covered by eval cases.

**Lesson.** _A rule you did not write down is a rule the model will guess._ List every situation where
a wrong guess is costly, say what to do in each, then test it.

### 28. A skipped check looks exactly like a passing one

**What happened.** The obvious way to write the eval is to skip it when no API key is set, so
`npm test` never breaks for someone without one. But a skipped suite reports green.

**Fix.** The eval is its own command, and with no key it fails with a message saying so.

**Lesson.** _An optional check that can quietly do nothing will, eventually, and no one will notice._
Make "did not run" loud (the same lesson as #15).

### 29. Testing a copy of the code tests the copy

**What happened.** The model call lived inside the API route. An eval written beside it would have
needed its own copy of the call, and the two could drift apart, so the eval would pass while production
did something else.

**Fix.** The call moved into `lib/extract.ts`. The route and the eval both use it.

**Lesson.** _Share the code under test; do not rebuild it for the test._ If it is hard to call from a
test, that is a sign it is in the wrong place.

### 30. A regular expression flag the project's TypeScript target rejects

**What happened.** The prompt tests used the `s` flag (so `.` matches line breaks). TypeScript refused
it because the project targets an older JavaScript level.

**Fix.** `[\s\S]*` instead of `.*`, which means the same thing without the flag.

**Lesson.** _Run the type check, not only the tests._ Jest passed while `tsc` failed, because Jest does
not check types.

### 31. The 503 explanation said "hourly", but the budget is per minute

**What happened.** The Docs page described the shared budget as "hourly". The limit is 300 calls per
60 seconds. Nothing failed, but a reader would plan around the wrong number.

**Caught by.** Re-reading the page while writing the out-of-credit message.

**Fix.** The text now says "per-minute", and the page's other numbers still come from `lib/config.ts`.

**Lesson.** _A number written in words is not tied to the setting it describes._ Prefer printing the
value from the config, or leave the unit out of the prose.

### 32. Every upstream failure looked the same

**What happened.** The route turned any failure from the AI service into "We couldn't parse that note.
Please try again." That is right for a hiccup and wrong when the account has run out of credit: the
person keeps retrying a demo that cannot work, and the owner sees nothing different in the log.

**Fix.** A small check (`lib/upstream-errors.ts`) recognises the out-of-credit error from its status
and error type, never by `instanceof`. It answers 503 with a clear message and logs
`out of credit`. Everything else stays a generic 502.

**Lesson.** _Give each failure a message that matches what the person can do about it._ "Try again" is
only honest when trying again can help.

### 33. The checks were green on my machine and red in CI, on every push

**What happened.** The type check failed in GitHub Actions with `Cannot find name 'LayoutProps'`. That
type is generated by Next.js into `.next/` whenever the app runs or builds. My machine always had that
folder, so the check passed locally. A clean checkout has no `.next/`, so CI failed. It failed on every
push from the first commit, and nobody noticed, because the assistant that wrote the code could not see
GitHub and never asked.

**Caught by.** Looking at the CI result after pushing, then reproducing it in a fresh clone of the
repository (the error appeared immediately).

**Fix.** The `typecheck` script now runs `next typegen` first, which generates those types without
building. A test checks the script keeps doing so. The whole CI sequence was then run in a clean clone
with a real `npm ci` install, and the browser tests ran there with `CI=true`.

**Lesson.** _"It passes on my machine" proves nothing about a clean machine._ Anything generated or
cached locally (build output, generated types, installed tools, environment variables) can hide a
missing step. Before trusting CI, run it from a fresh clone, and look at the real CI result after every
push instead of assuming it is green.

### 34. Mobility was one value, so "a wheelchair, a cane or a walker" came back "unknown"

**What happened.** The owner tried a note that named three aids. The card showed "Unknown" and said the
note "conflicts". The data could hold only one mobility value, so the AI did what the instructions told
it to when it could not choose: it gave up. The AI was not wrong. The shape of the data could not say
what the note said. "Unknown" had been standing in for two different things (not stated, and not
possible to express), which is why it could not be described better; the list separates them.

**Caught by.** The owner, trying it in the browser. None of the eval notes named more than one aid.

**Fix.** `mobility` became a list of aids (`wheelchair`, `stretcher`, `walker`, `cane`, `crutches`,
`scooter`, `other`, or `ambulatory` alone), validated with no repeats. The prompt now tells the AI to
translate plain words into those categories and to list every aid, even when the note joins them with
"or". New eval cases cover the exact note, aids for different places, and categorising (a rollator is a
walker, a power chair is a wheelchair, a white cane is a cane).

**Lesson.** _If the shape of your data cannot say what the input said, the AI will pick the nearest wrong
answer._ Design the schema from real inputs, including awkward ones, and when the AI "refuses" or says
"unknown", ask whether the schema left it no good option.

### 35. One unlucky answer failed a critical eval case

**What happened.** A live run failed a critical case: "Friday 3pm" came back with a null time. The same
note had passed an earlier run.

**Caught by.** The live eval. Before touching the prompt, the note was sent 16 times: it gave `15:00`
every time. So the failure was one unlucky answer, not a regression.

**Fix.** A failing case is now run twice more and passes if it passes two of its three runs. A case that
passes some runs and fails others is printed as FLAKY, so unreliable behaviour is still reported.

**Lesson.** _A model gives different answers to the same question, so one sample proves little._ Measure a
rate before changing anything, and do not tune a prompt to fix a single bad answer.

### 36. A wordy answer turned a good note into an error, and hid every other result

**What happened.** After adding rules that ask the AI to explain time zones and unclear aids, its `notes`
line sometimes ran past 300 characters. The SDK throws when an answer breaks a length rule, so the API
answered "We couldn't parse that note" for a perfectly good note. In the eval, the same exception
rejected the whole batch, so every case looked failed and the real results were hidden. It also made
the AI occasionally return no time for a plain "2pm" (2 of 12 runs).

**Caught by.** Two eval runs where every critical case failed at once, which pointed at the run itself and
not the answers. The error text named the rule ("notes: max 300 characters").

**Fix.** The SDK now parses with a lenient copy of the schema that describes exactly the same JSON to the
model (a test checks this). Two harmless slips are then repaired: a long notes line is cut to the limit
with an ellipsis, and a repeated aid is removed. Everything else, such as a malformed time, a name over
the limit, or "walks unaided" mixed with an aid, is still checked strictly and still returns an error.
The prompt asks for notes under 200 characters. The eval harness now treats a request that throws as one
failed attempt instead of letting it stop the run. After the change, 64 repeat runs of the four notes
involved gave no null times and no errors, and two full live runs passed all 39 cases.

**Lesson.** _A rule that rejects the whole answer is the wrong tool for a harmless slip._ Repair what is
safe to repair, and keep strict checks for what could cause harm. And when everything fails at once,
suspect the run, not the individual answers.

---

# What these have in common

- **Most bugs were found by a test written for a different reason.** Writing a test for a new feature
  exposed an old bug (#1, #2, #4, #5, #6). Keep adding tests at the edges.
- **The browser finds what simulations cannot** (#4, #5, #6, #16).
- **Limits need testing at their boundaries**, including the strange settings (#2, #3, #14).
- **Order matters** for cleanup versus validation (#1) and for stacked limits (#13).
- **Passing tests can say nothing about the thing you care about** (#26). If the AI is the product,
  test the AI, with real answers and a pass rate.
- **Unwritten rules get guessed** (#27), and **unwritten checks get skipped** (#28). Write them down,
  and make "did not run" loud.
- **Green locally is not green in CI** (#33). Run the checks from a fresh clone, and read the real CI
  result after every push.
- **The shape of the data steers the AI** (#34), and **one sample proves little** (#35). Design the
  schema from awkward real inputs, and measure how often something happens before changing anything.
- **Repair harmless slips; reject harmful ones** (#36). A strict rule that fails the whole answer turns a
  verbose reply into an outage.
- **Say so when you are wrong.** Writing the mistake down is the fastest way to stop repeating it.
