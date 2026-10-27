# Scaling, cost and abuse protection

RideNote has no images, no database and almost no JavaScript to download, so the things that
usually make a site slow are not the problem here. The cost and the risk are the same thing:
**every parse is a paid call to an AI service that takes seconds.** Everything below is about making
fewer of those calls, and about not letting anyone else make them for us.

## The numbers, and why

All of them live in `lib/config.ts`.

| Limit                      | Value                 | Why                                                                                                                                                                                        |
| -------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Note length                | 5 to 1,000 chars      | A dispatcher note is a few sentences, 100 to 400 characters. 1,000 leaves room for a pasted email snippet. Cost grows with input length, so every extra character allowed is cost allowed. |
| Request body               | 8 KB                  | 1,000 characters written as 6-byte JSON escapes is 6,000 bytes, plus the wrapper. Nothing legitimate needs more, and a small cap makes junk cheap to refuse.                               |
| Answer size (`max_tokens`) | 600                   | A trip is about 150 tokens; the schema caps the worst case near 450. A tight ceiling caps what a confused or manipulated answer can cost.                                                  |
| Per client                 | 10 requests / minute  | Counts every request, valid or not, so junk traffic is throttled too.                                                                                                                      |
| All clients together       | 300 AI calls / minute | Stops many quiet clients (a distributed flood) from running up the bill. Beyond it the API answers 503.                                                                                    |
| At once, per server        | 10 AI calls           | A slow upstream cannot pile up unbounded work and memory. Extra requests get 503 immediately instead of queueing.                                                                          |
| Browser timeout            | 65 s                  | A request never hangs forever.                                                                                                                                                             |

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

## Known limits

- Without a proxy header (local dev, bare `next start`) all clients share one bucket.
- Per-instance counters mean the effective global limit is `300 x number of instances` until a
  shared store is added.
- Coalescing and the concurrency gate are per instance too.
