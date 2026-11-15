# Performance, cost and abuse protection

RideNote has no images and almost no JavaScript to download, so the things that
usually make a site slow are not the problem here. The cost and the risk are the same thing:
**every parse is a paid call to an AI service that takes seconds.** Everything below is about making
fewer of those calls, and about not letting anyone else make them for us.

## The numbers, and why

All of them live in `lib/config.ts`.

| Limit                      | Value                                           | Why                                                                                                                                                                                                                                                                           |
| -------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Note length                | 5 to 1,000 chars                                | A dispatcher note is a few sentences, 100 to 400 characters. 1,000 leaves room for a pasted email snippet. Cost grows with input length, so every extra character allowed is cost allowed.                                                                                    |
| Request body               | 8 KB                                            | 1,000 characters written as 6-byte JSON escapes is 6,000 bytes, plus the wrapper. Nothing legitimate needs more, and a small cap makes junk cheap to refuse.                                                                                                                  |
| Answer size (`max_tokens`) | 600                                             | A trip is about 150 tokens; the schema caps the worst case near 450. A tight ceiling caps what a confused or manipulated answer can cost.                                                                                                                                     |
| Per client                 | 3 requests / minute in production, 10 elsewhere | Counts every request, valid or not, so junk traffic is throttled too. Production is strict because every parse can also add a public History entry; development and preview stay loose so testing is not painful. An edge rule enforces the same number before any code runs. |
| All clients together       | 300 AI calls / minute                           | Stops many quiet clients (a distributed flood) from running up the bill. Beyond it the API answers 503.                                                                                                                                                                       |
| At once, per server        | 10 AI calls                                     | A slow upstream cannot pile up unbounded work and memory. Extra requests get 503 immediately instead of queueing.                                                                                                                                                             |
| Browser timeout            | 29 s                                            | Derived from the server's own worst case (12 s upstream timeout, one retry, 5 s headroom), so a request never hangs forever and the two never disagree.                                                                                                                       |

If real notes turn out to be longer, raise `noteMax` and `bodyMaxBytes` together (body = 6 x note
length + 100, rounded up).

## Order of checks (cheapest first)

1. Per-client rate limit
2. `Content-Type` is JSON (415)
3. Size: `Content-Length`, then a streamed read that stops at the cap (413)
4. Valid JSON (400)
5. Valid note: length, hidden characters, markup (400)
6. **Only now** the paid part: join an identical in-flight call, or take a concurrency slot and spend
   shared budget (503 if full), then call the AI.

Everything before step 6 costs almost nothing, so junk is refused before it can cost money.

## Fewer AI calls

- **Browser:** pressing Parse again on a note that is already parsed and unchanged does nothing.
  A failed attempt can be retried.
- **Server:** identical notes submitted at the same moment share one AI call (`lib/coalesce.ts`).
  Nothing is kept afterwards, so no note or result is stored.
- **Not done on purpose:** a time-limited result cache. It would save calls for repeated notes but
  would hold passenger details in memory. Decide that with the privacy review before adding it.

## What the code cannot do alone

The limiters run inside the app, after a request has already reached a server. That is fine for
cost control, but it is not DDoS protection, and on serverless hosting each instance counts
separately. For production, add:

1. **Edge rate limiting and bot protection in front of the app** (Vercel Firewall, Cloudflare, or
   similar). This is the real DDoS layer: abusive traffic is dropped before it reaches a function.
   Put a rule on `POST /api/parse`.
2. **A shared counter** (Redis, for example Upstash or Vercel KV) behind `createRateLimiter`, so the
   per-client and shared budgets hold across every instance. The limiter is one small function, so
   this is a contained change.
3. **A spending cap on the Anthropic key**, set in the Anthropic console. It is the last line of
   defence if everything else fails.
4. **Sign-in**, if the site will be public. An anonymous per-IP limit is the weakest kind.
5. **Alerts** on the rate of 429 and 503 responses. A rising 503 rate means the shared budget is
   being hit, either by growth or by an attack.

## Running a public demo cheaply

The strongest cost control is outside the code: a **separate key with a small prepaid balance or a
workspace spend limit** ($2 to $5), with auto-reload off. Whatever happens, the bill cannot pass that
cap. Inside the code, the per-client limit, shared budget, concurrency gate, 1,000 character note limit
and 600 token answer cap keep each parse small. When the account runs out of credit the API answers
503 with `code: "out_of_credit"`, the page shows a clear message, and the log says
`parse failed: out of credit`, so the owner knows the demo's fixed budget is spent. It stays unavailable until the monthly limit renews; the limit is not raised on request.

## What one parse costs

The AI call has its hidden reasoning turned off, because extraction does not need it. A parse is about
160 output tokens on average, against about 550 with reasoning on, so it is roughly a third of the
cost and faster. The 600-token cap leaves room for the worst case. If you ever turn reasoning back on,
raise `UPSTREAM.maxTokens` too: reasoning counts against the cap, and a tricky note can use all of it
and cut the answer off.

## What an agent run costs and how long it takes

The parse above is one AI call. The **agent** (see [the agent page](AGENT.md)) is different: it is an
AI that can look things up and decide what to do next, so one **run** is several calls in a row, each
one called a **step**. A **token** is the small piece of text, roughly three quarters of a word, that
the AI service counts and charges for. More steps and more tokens mean more cost and more waiting.

### What was measured

These figures come from one saved live test, the file
`evals/agent-results/2026-11-14-claude-haiku-5-5-final-pre-merge.json`, run on 2026-11-14 with the
`claude-haiku-5-5` model. Treat them as a first reading, not a promise.

- **Cost:** about $0.0011 per run, which is a little over a tenth of a cent. That is the whole bill for
  the test divided by 19 runs.
- **Tokens:** about 8,740 input tokens and 430 output tokens per run. Input is what we send (the
  instructions, the note and everything the lookups returned so far). Output is what the AI writes.
- **Steps:** about 3 steps per run. A clear note can finish sooner; a vague one needs a lookup and a question.
- **Output per step:** about 150 output tokens per step, which is total output divided by total steps.
- **Time:** from 4.6 seconds for the quickest case to 9.4 seconds for the slowest, per run.

The limit on one step's output is 400 tokens. The saved results keep only totals for each case, not the
longest single step, so that 400 limit is **not measured** beyond the average of about 150. It is a
safety ceiling chosen by judgement, not a number the test confirmed.

Two cautions:

- **It is one small model on 9 cases and 19 runs on one day.** A different model, different notes or a
  busier day can give different numbers. Re-run the live test (`npm run eval:agent`) after a change and
  commit the new file.
- **A saved case adds up its attempts.** Of the 9 cases, five cases run 3 times each (the ones that
  matter most) and the other four once, which makes 19 runs. The file stores each case's tokens and
  time as sums. So the per-run figures above divide time by the number of
  attempts, and tokens by the number of runs. The per-step figure assumes every attempt took as many
  steps as the last one did, so it is approximate.

### Reserving the worst case first

Before a run makes its first paid call, the route asks the shared pool of AI calls for the worst case
at once: 7 model calls (the 6 steps plus the one that reads the note), in `app/api/agent/route.ts`. If
the pool cannot cover that, the run is refused with a 503 before anything is spent. This stops many runs
from starting together and then each running out of budget halfway.

Two protections sit around every run:

- **A per-client rate limit** counts how often one visitor can start something: 2 runs a minute in
  production (5 elsewhere) and 10 approvals a minute.
- **A concurrency gate** limits how many AI calls run at the same moment on one server. It has the same size as the
  parse route's gate (10), so extra requests get a 503 at once instead of queueing.

### Time limits

Each step waits at most 15 seconds for the AI. On a timeout or a server error it tries once more. The
whole run has a 60 second **deadline**, a wall-clock limit that also cancels a call still waiting. The
retry shares that deadline, so it never extends it.

### Each limit and what it protects against

| Limit                          | Value                        | What it prevents                                                                                                   |
| ------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Steps in one run               | 6 steps                      | A loop that keeps calling the AI. A normal run takes about 3, so 6 leaves room for one recovery.                   |
| Tokens in one run              | 20,000 tokens                | A run that is cheap per step but grows without end, because the input grows each step. A hard cost cap.            |
| Tokens the AI may write a step | 400 tokens                   | A rambling or manipulated answer. A tool call is short. This ceiling is not measured beyond the average.           |
| Time for the whole run         | 60 seconds                   | A run that hangs, and the server work and money tied up while it waits.                                            |
| Time for one step              | 15 seconds, one retry        | One slow call using up the whole deadline.                                                                         |
| Runs per client                | 2 runs a minute (production) | One visitor, or a script, starting many runs.                                                                      |
| Approvals per client           | 10 approvals a minute        | Someone hammering the Approve button.                                                                              |
| Concurrency gate               | 10 calls at once per server  | A pile-up of work and memory when the AI service is slow.                                                          |
| Ids only from a lookup         | Checked in code              | The AI inventing a rider id. A rider id must come from a lookup earlier in the same run, so it cannot make one up. |
| Signed drafts                  | Expire after 15 minutes      | A changed or old draft being approved. The draft carries a signature, so an edit is detected.                      |

Everything in this table that has a number lives in `lib/config.ts` (`AGENT`, `AGENT_RATE` and
`BUDGET`), and a test reads it from there. The measured figures and most limits are also checked by tests
against the committed results and `lib/config.ts`. A few rows are not pinned by a test: the 5 per
minute outside production, the 15 minute draft expiry, "ids only from a lookup" and the retry count.

## Known limits

- Without a proxy header (local dev, bare `next start`) all clients share one bucket.
- Per-instance counters mean the effective global limit is `300 x number of instances` until a
  shared store is added.
- Coalescing and the concurrency gate are per instance too.

## Questions about limits and cost

These answers moved here from the [FAQ](FAQ.md), because they are about the limits and the cost.

### What does 429 mean, and what does 503 mean? They both say "try later".

- **429**: _you_ sent too many requests (3 per minute per client on the live site, 10 in development and preview). The `Retry-After` header says when.
- **503**: _everyone together_ is using too much (the shared AI budget or the simultaneous-call cap).
  It protects cost and the server. It is not about you in particular.

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
so on serverless hosting each instance counts separately. See "Known limits" below.

### Can I change the limits?

Yes, in `lib/config.ts` only. If you raise `LIMITS.noteMax`, raise `LIMITS.bodyMaxBytes` too (body =
6 x note length + 100, rounded up). Run `npm test`; the tests are written against the constants, so
they follow the change.

### It says "This demo has used up its AI budget". What now?

The demo's fixed monthly limit is spent. It stays unavailable until the limit renews, and it is not
raised on request. To keep going, run RideNote yourself: clone the repository, create your own key in
your Anthropic account, put it in `.env.local` (or run `npm run dev:key` on a Mac), and start it.

### Is it safe to leave the public demo running?

The most it can cost is the spend limit on the demo's API key, because the key has a small fixed cap. For how the demo is kept cheap, see "Running a public demo cheaply" above.
