# Best practices this project is built on

A short knowledge base for junior developers. Each practice says **what**, **why**, and **where to
see it in this code**. The [FAQ](FAQ.md) has the real bugs that taught or confirmed many of these.

## 1. Never hardcode: one source of truth for every value

**What.** A number, a piece of text, or a URL appears in exactly one place. Everything else reads it.

| Kind of value                         | Lives in                             |
| ------------------------------------- | ------------------------------------ |
| Limits, timeouts, status codes, model | `lib/config.ts`                      |
| Every message a person reads          | `lib/messages.ts`                    |
| Every URL                             | `lib/routes.ts`                      |
| Secrets (keys)                        | environment variables, never in code |

**Why.** Imagine "1000" (the note limit) typed in the form, the server, the error message, the tests
and the docs. Someone changes four of them. Now the form says one thing and the server says another.
With one definition, a change in one place is a change everywhere.

**Including tests and docs.** Tests should say `LIMITS.noteMax`, not `1000` (FAQ #12). The docs pages
print the real constants, so they cannot go stale.

**Not everything is config.** Values that are the _meaning_ of the code (HTTP 200 means OK) are
fine to name once; values that someone might reasonably tune belong in config. If you would
discuss changing it in a meeting, it is config.

## 2. Validate at every boundary, and never trust what arrives

**What.** Check data when it enters your system, and again when it crosses between parts: the form
checks input, the server checks it again, the AI's answer is checked, and the browser checks the
server's reply.

**Why.** Anyone can call your API without your form. The AI can return something unexpected. The
network can corrupt or replace a reply. Each side treats the other as untrusted, even when it is
"your own" code.

**See.** `lib/validation.ts` (one definition shared by form and API), `lib/trip.ts` (the shape of an
answer), `lib/api-client.ts` (re-checks the server's reply).

## 3. Reject, do not silently fix

**What.** If input is bad, refuse it and say why. Do not quietly strip or rewrite it.

**Why.** Silent changes hide what happened and can change meaning. A visible refusal is honest and
easy to test. (Careful with your own cleanup steps, too: they can erase what you meant to reject.
FAQ #1.)

## 4. Cheapest check first

**What.** Order checks from cheapest to most expensive and stop at the first failure.

**See.** The API route: rate limit, content type, size, JSON, validation, and only then the paid AI
call. Junk is refused before it can cost money (`docs/SCALING.md`).

## 5. Every limit has a reason, and is tested at its edges

**What.** Write down why each number is what it is, and test just below, at, and just above it.

**Why.** "10,000 entries" never failed; "1 entry" did (FAQ #2). Limits hide their bugs at the
boundaries and at unusual settings.

## 6. A disabled button is a hint; a lock is code

**What.** Prevent double actions with synchronous state (a ref), not only by disabling the button.

**Why.** UI state updates are asynchronous; a fast double click gets through (FAQ #4).

## 7. Fail loudly, never confidently wrong

**What.** If something the code depends on is missing, crash or show a clear error. Do not return a
plausible-looking empty answer.

**See.** The Tests page refuses to build with zero tests found (FAQ #15). The parser returns `null`
and "Missing" rather than inventing a value.

## 8. Tell people what is going on

- Show the number the system really uses (FAQ #7).
- Say when displayed data is out of date (FAQ #8).
- Tell people how long to wait when you know (FAQ #9).
- Keep what they typed when something fails.
- Write messages for the person using the page, not the developer.

## 9. Protect personal data by default

- Never log the content of a request that may hold personal details. Log an error _type_, and numbers such as token counts, never the content.
- Do not store what you do not need. Decide a cache only after a privacy decision.
- Use fictional data in tests, examples and bug reports.
- Keep secrets on the server. The browser never sees the API key.

## 10. Control cost like a security problem

**What.** Anything that triggers paid work needs limits per client, across everyone, and in
parallel; a size cap on input and on output; and de-duplication of identical work.

**Why.** Cost and attack surface are the same surface. See `docs/SCALING.md`. Remember that limits
inside the app are not a substitute for protection in front of it.

## 11. Testing habits

- **Write the test, watch it fail, then make it pass.** A test you have never seen fail may test
  nothing. (After fixing the double-submit bug, the lock was removed once to prove the test caught it.)
- **Use three layers.** Unit tests for logic, component tests for screens, end-to-end tests in a real
  browser for what only a browser can break (layout, focus, real clicks, headers).
- **Cover positive, negative and out-of-scope.** What works, what must be refused, and what the
  product does not do, and how it behaves when asked anyway.
- **Test with hostile data**, not only friendly data: very long text with no spaces, invisible
  characters, quotes and backslashes, other languages, empty and huge input.
- **Make documentation examples executable.** `lib/docs-examples.ts` feeds both the Docs page and a
  test, so the documentation cannot disagree with the code.
- **Mock the paid service**, so tests are free, fast and repeatable.
- **Keep a coverage floor** in the build (`jest.config.mjs`). Coverage does not prove correctness,
  but a falling number is an early warning.
- **Run the slow suite after changing what it tests** (FAQ #16).
- **Parallel tests must not share state.** Use unique values (FAQ #21).
- **When a test fails after an intentional change, update it deliberately** and say why (FAQ #17).

## 12. Accessibility is part of "done"

Label every control; keep keyboard order sensible; provide a skip link; announce errors; keep focus
where the user expects; check colour contrast in light and dark mode; test at 320 px wide. This
project runs axe checks in unit tests and in a real browser.

## 13. Code readability

- Name things for what they mean (`trimOrdinary`, `readLimitedText`), not how they work.
- Comment the _why_ (a limit's reasoning, a non-obvious bug), not the _what_.
- Never put invisible characters in source; use `\uXXXX` escapes (FAQ #20).
- Keep files small and single-purpose: the limiter, the gate and the coalescer are three tiny
  modules, each fully tested, not one large one.

## 14. Working with an AI assistant

- Read what it writes; it is confident in the same tone whether right or wrong.
- Ask it to run the checks, and read the output yourself.
- Have another pass review the work (this project used an automated review that found real bugs).
- Check review findings against the code in both directions: they are often half right (FAQ #18).
- Ask for mistakes to be written down. That is how this FAQ exists.

## 15. Habits for the commit and the team

- Run `npm run check` before committing (the pre-commit hook does).
- Small, reviewable changes; one purpose per commit.
- Document decisions and their reasons, not only the result (`docs/SCALING.md` explains each limit).
- Keep a "Known limits" section honest. Pretending a limitation does not exist helps nobody.
