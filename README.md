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

You need **Node.js 20.9 or newer** and an [Anthropic API key](https://console.anthropic.com/).

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

The site has four pages, reachable from the navigation on the left (a **Menu** button on phones):

| Page             | Path            | What it is                                                                 |
| ---------------- | --------------- | -------------------------------------------------------------------------- |
| **Parser**       | `/`             | The tool itself.                                                           |
| **Requirements** | `/requirements` | The PRD, required input, expected JSON output and what valid JSON is.      |
| **Docs**         | `/docs`         | Setup, accepted and rejected inputs, JSON pitfalls, every error explained. |
| **Tests**        | `/tests`        | Every automated test name, read from the real test files at build time.    |

What to type, in short: who, where from, where to, when, and mobility (`ambulatory`, `wheelchair`,
`stretcher`; otherwise `unknown`). A state or zip is optional. A note with none of these is still
accepted; it returns mostly empty fields. The Docs page has 12 accepted and 13 rejected example
notes, each verified against the real validator by a test.

## The API

One endpoint: `POST /api/parse`.

```bash
curl -X POST http://localhost:3000/api/parse \
  -H 'Content-Type: application/json' \
  -d '{"note": "Pick up Mrs. Lee at 12 Oak St at 9:30am to County Hospital, wheelchair"}'
```

| Status | Meaning                                                                   |
| ------ | ------------------------------------------------------------------------- |
| 200    | Success. Body is `{ "trip": { ... } }`.                                   |
| 400    | Bad input: invalid JSON, or a note that fails validation (with a `code`). |
| 413    | Request body too large.                                                   |
| 415    | Not sent as `application/json`.                                           |
| 422    | The AI declined to process the note.                                      |
| 429    | Too many requests from this client. See the `Retry-After` header.         |
| 502    | The AI service failed, or its answer had the wrong shape.                 |
| 503    | The server is protecting itself from overload. See `Retry-After`.         |

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
  rate-limit.ts concurrency.ts coalesce.ts read-body.ts   Abuse and cost protection
e2e/                    Browser tests (Playwright)
docs/                   Guides (see below)
```

Tests sit next to the code they test (`foo.ts` and `foo.test.ts`).

## Testing

```bash
npm test                # unit and component tests (Jest)
npm run test:coverage   # same, with a coverage report and an enforced floor
npm run test:e2e        # real-browser tests (first run: npx playwright install chromium)
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

| Read this                                        | When you want to                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| [docs/GUIDE.md](docs/GUIDE.md)                   | Understand the whole project from scratch                                    |
| [docs/FAQ.md](docs/FAQ.md)                       | See common questions and **the bugs we hit and what they taught us**         |
| [docs/BEST-PRACTICES.md](docs/BEST-PRACTICES.md) | Learn the habits this code is built on                                       |
| [docs/SCALING.md](docs/SCALING.md)               | Understand cost, limits and abuse protection, and what to add for production |

This repository uses Next.js 16, which differs from older versions. See `AGENTS.md`: read the guides in
`node_modules/next/dist/docs/` before changing framework-level code.

## Troubleshooting

| Symptom                                    | Likely cause and fix                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| "We couldn't parse that note" every time   | Missing or wrong `ANTHROPIC_API_KEY`. The terminal shows `parse failed: <ErrorType>`. |
| 429 while testing by hand                  | You passed 10 requests in a minute. Wait for `Retry-After` seconds.                   |
| Everyone shares one rate limit locally     | Normal in dev: no proxy headers, so all clients look the same. See the FAQ.           |
| `npm run test:e2e` cannot launch a browser | Run `npx playwright install chromium` once.                                           |
| Tests page says it found no test files     | The build must run where the source files exist. See the FAQ.                         |
