# RideNote

Paste a dispatcher's free-text note, get a structured trip record: passenger, pickup, dropoff, pickup
time and mobility, shown as a card. Anything the note does not say is marked **Missing**, never guessed.

> "Pick up Mrs. Lee at 12 Oak St at 9:30am, taking her to County Hospital. She uses a wheelchair."

```json
{
  "trip": {
    "passenger_name": "Mrs. Lee",
    "pickup_location": "12 Oak St",
    "dropoff_location": "County Hospital",
    "pickup_time": "09:30",
    "mobility": "wheelchair",
    "missing_fields": [],
    "notes": ""
  }
}
```

Built with Next.js 16, the Claude API (Anthropic), Zod, React Query and Zustand.

## Contents

- [Quick start](#quick-start)
- [Getting an API key](#getting-an-api-key)
- [Sharing or deploying a demo](#sharing-or-deploying-a-demo)
- [Configuration](#configuration)
- [Using it](#using-it)
- [The API](#the-api)
- [Limits](#limits)
- [Project layout](#project-layout)
- [Testing](#testing)
- [Scripts](#scripts)
- [Documentation map](#documentation-map)
- [Troubleshooting](#troubleshooting)

## Quick start

You need **Node.js 20.9 or newer** (`.nvmrc` pins 22; `package.json` enforces the minimum) and an
[Anthropic API key](https://console.anthropic.com/). No key yet? See
[Getting an API key](#getting-an-api-key) below; it takes about five minutes.

```bash
git clone <this repository>
cd ridenote
npm install
cp .env.example .env.local     # then open .env.local and paste your key
npm run dev                    # http://localhost:3000
```

Check that it works: click **Use an example**, then **Parse**. A card for "Mrs. Lee" should appear.

To run the production build locally:

```bash
npm run build
npm start
```

## Getting an API key

RideNote calls the Claude API, so it needs a key from your own Anthropic account. Each person who
runs it locally uses **their own key**; the repository contains none.

1. Sign in (or create an account) at [console.anthropic.com](https://console.anthropic.com/).
2. Add a small amount of credit under billing, for example **$5**, and leave auto-reload **off**. When
   the balance is used up, calls stop instead of charging more. One parse costs a fraction of a cent.
3. Open **API keys** and create a key. Name it after the project (for example `ridenote-local`). If you
   can, create it inside its own workspace with a low monthly spend limit.
4. Copy the key straight away. The Console shows it only once.
5. Run `cp .env.example .env.local`, open `.env.local`, and paste the key after `ANTHROPIC_API_KEY=`.
6. Start (or restart) the app with `npm run dev`, click **Use an example**, then **Parse**.

Menu names in the Console change from time to time; look for "API keys" and "Billing".

Keep the key safe:

- Never commit it, paste it into an issue, a chat or a screenshot, or put it in code. `.env.local` is
  git-ignored and the pre-commit hook refuses env files.
- Never give it a `NEXT_PUBLIC_` prefix. Next.js would send it to every visitor's browser.
- If it leaks, delete it in the Console and make a new one. That is the only real fix.
- Use a different key for each person and each environment, so one can be revoked on its own.

## Sharing or deploying a demo

Someone who only wants to _see_ RideNote should not have to create a key.

- **Best: host it.** Deploy the app (for example on Vercel) and store the key as a **server-only**
  environment variable, using a key made for the demo with a low spend limit ($2 to $5 is plenty).
  Visitors open a URL and click Parse. They never see the key. The app's per-client limit
  (10 requests a minute), shared budget, 1,000 character note limit and 600 token answer cap keep
  what anyone can do through it small.
- **Next best: hand out a temporary key privately.** Send it directly to the person (never in the
  repository, README or a pull request) and make it a capped key you can revoke. Someone holding a key
  can call the API directly, up to its cap, not just through this app, so keep the cap low and do not
  reuse that key anywhere else.
- **When the demo's credit runs out,** the parser shows "This demo has used up its AI budget" (the API
  answers 503 with code `out_of_credit`) and the server log says `parse failed: out of credit`. The
  person can then follow Getting an API key above and use their own key. To bring a demo back, add
  credit or raise its spend limit.
- **Watch it.** Check usage in the Console now and then, and delete the key if anything looks wrong.

## Configuration

Secrets live in environment variables, never in code. `.env.local` is git-ignored; `.env.example` is
the committed template.

| Variable            | Required | What it does                                                  |
| ------------------- | -------- | ------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | yes      | Your key. Read only on the server, never sent to the browser. |
| `MODEL`             | no       | Claude model to use. Defaults to `UPSTREAM.defaultModel`.     |

Every other tunable number (limits, timeouts, status codes) lives in **`lib/config.ts`**, and every
piece of user-facing text in **`lib/messages.ts`**. Change them there, not in the code that uses them.

## Using it

The site has four sections, reachable from the navigation on the left (a **Menu** button on phones):

| Page             | Path            | What it is                                                                 |
| ---------------- | --------------- | -------------------------------------------------------------------------- |
| **Parser**       | `/`             | The tool itself.                                                           |
| **Requirements** | `/requirements` | The PRD, required input, expected JSON output and what valid JSON is.      |
| **Docs**         | `/docs`         | Setup, accepted and rejected inputs, JSON pitfalls, every error explained. |
| Docs: **Eval**   | `/docs/eval`    | How the live accuracy eval works, with every case listed.                  |
| Docs: **FAQ**    | `/docs/faq`     | Common questions, and the bugs found along the way with their lessons.     |
| **Tests**        | `/tests`        | Every automated test name, read from the real test files at build time.    |

What to type, in short: who, where from, where to, when, and mobility (`ambulatory`, `wheelchair`,
`stretcher`; otherwise `unknown`). A state or zip is optional. A note with none of these is still
accepted; it returns mostly empty fields. The Docs page has 13 accepted and 13 rejected example
notes, each verified against the real validator by a test.

## The API

One endpoint: `POST /api/parse`.

```bash
curl -X POST http://localhost:3000/api/parse \
  -H 'Content-Type: application/json' \
  -d '{"note": "Pick up Mrs. Lee at 12 Oak St at 9:30am to County Hospital, wheelchair"}'
```

| Status | Meaning                                                                                       |
| ------ | --------------------------------------------------------------------------------------------- |
| 200    | Success. Body is `{ "trip": { ... } }`.                                                       |
| 400    | Bad input: invalid JSON, or a note that fails validation (with a `code`).                     |
| 413    | Request body too large.                                                                       |
| 415    | Not sent as `application/json`.                                                               |
| 422    | The AI declined to process the note.                                                          |
| 429    | Too many requests from this client. See the `Retry-After` header.                             |
| 502    | The AI service failed, or its answer had the wrong shape.                                     |
| 503    | Overloaded (see `Retry-After`), or the AI account is out of credit (`code`: `out_of_credit`). |

Errors are JSON too: `{ "error": "human readable message", "code": "required" }`. The Docs page
explains each status and each validation code.

## Limits

All in `lib/config.ts`. The reasoning behind each number is in [docs/SCALING.md](docs/SCALING.md).

| Limit                 | Value                           |
| --------------------- | ------------------------------- |
| Note length           | 5 to 1,000 characters (trimmed) |
| Request body          | 8 KB                            |
| Per client            | 10 requests per minute          |
| All clients together  | 300 AI calls per minute         |
| Simultaneous AI calls | 10 per server                   |

## Project layout

```
app/                    Pages and the API route (Next.js app router)
  page.tsx              The parser
  docs/ requirements/ tests/   The documentation pages
  api/parse/route.ts    The one server endpoint
components/             NoteForm, ResultPanel, TripCard, SideNav, TryButton, Providers
lib/                    Logic with no visual parts
  config.ts             Every limit and number
  messages.ts           Every piece of user-facing text
  routes.ts             Every URL
  validation.ts         The rules for a valid note
  trip.ts               The shape of a parsed trip
  extract.ts prompt.ts  The model call and its instructions
  rate-limit.ts concurrency.ts coalesce.ts read-body.ts   Abuse and cost protection
e2e/                    Browser tests (Playwright)
evals/                  Live accuracy check of the parser against the real model
docs/                   Guides (see below)
```

Tests sit next to the code they test (`foo.ts` and `foo.test.ts`).

## Testing

```bash
npm test                # unit and component tests (Jest)
npm run test:coverage   # same, with a coverage report and an enforced floor
npm run test:e2e        # real-browser tests (first run: npx playwright install chromium)
npm run eval            # live accuracy check against the real model (needs a key, costs cents)
npm run check           # types + lint + formatting + unit tests
npm run test:all        # everything
```

- **Unit and component tests** cover validation, the API route (with a stand-in AI, so tests cost
  nothing), rate limiting, the UI and accessibility (axe).
- **Coverage** is about 100% of statements, lines and functions and over 99% of branches. The build
  fails if it drops below 98% / 95% / 98% / 98% (statements / branches / functions / lines).
- **End-to-end tests** run the real app in Chromium. They cover successful parses, every validation
  failure, every server and network failure, the real API's refusals (400, 413, 415, 405, 429),
  navigation, accessibility in light and dark mode, phone-width layout, and things that are out of
  scope.

- **The accuracy eval** (`evals/`) sends a few dozen realistic notes to the real model through the same
  code the API uses and scores the answers. It covers complete notes, 12/24-hour and spoken times,
  fields that must stay null, an hour with no AM/PM, dates that must reach `notes`, mobility,
  several trips in one note, text that is not a trip, and instructions hidden in a note. Every
  _critical_ case must pass and at least 90% overall. Run it after changing `lib/prompt.ts`, the
  schema or `MODEL`. It is not part of `npm test` because it costs money.

A pre-commit hook runs `npm run check`. CI runs everything on every push.

## Scripts

| Script                            | Does                               |
| --------------------------------- | ---------------------------------- |
| `npm run dev`                     | Development server with hot reload |
| `npm run build` / `start`         | Production build and server        |
| `npm run lint` / `lint:fix`       | ESLint                             |
| `npm run format` / `format:check` | Prettier                           |
| `npm run typecheck`               | TypeScript without emitting files  |

## Documentation map

| Read this                                        | When you want to                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| [docs/GUIDE.md](docs/GUIDE.md)                   | Understand the whole project from scratch                                     |
| [docs/EVAL.md](docs/EVAL.md)                     | Learn how the live accuracy eval works and how it ties into prompt and schema |
| [docs/FAQ.md](docs/FAQ.md)                       | See common questions and **the bugs we hit and what they taught us**          |
| [docs/BEST-PRACTICES.md](docs/BEST-PRACTICES.md) | Learn the habits this code is built on                                        |
| [docs/SCALING.md](docs/SCALING.md)               | Understand cost, limits and abuse protection, and what to add for production  |

This repository uses Next.js 16, which differs from older versions. See `AGENTS.md`: read the guides in
`node_modules/next/dist/docs/` before changing framework-level code.

## Troubleshooting

| Symptom                                    | Likely cause and fix                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| "This demo has used up its AI budget"      | The key's credit or spend limit is used up. Add credit, raise the limit, or use a new key. |
| "We couldn't parse that note" every time   | Missing or wrong `ANTHROPIC_API_KEY`. The terminal shows `parse failed: <ErrorType>`.      |
| 429 while testing by hand                  | You passed 10 requests in a minute. Wait for `Retry-After` seconds.                        |
| Everyone shares one rate limit locally     | Normal in dev: no proxy headers, so all clients look the same. See the FAQ.                |
| `npm run test:e2e` cannot launch a browser | Run `npx playwright install chromium` once.                                                |
| Tests page says it found no test files     | The build must run where the source files exist. See the FAQ.                              |
