# RideNote

Paste a dispatcher's free-text note, get a structured trip record: passenger, pickup, dropoff, pickup
time and mobility aids, shown as a card. Anything the note does not say is marked **Missing**, never guessed.

> "Pick up Mrs. Lee at 12 Oak St at 9:30am, taking her to County Hospital. She uses a wheelchair."

```json
{
  "trip": {
    "passenger_name": "Mrs. Lee",
    "pickup_location": "12 Oak St",
    "dropoff_location": "County Hospital",
    "pickup_time": "09:30",
    "mobility": ["wheelchair"],
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
- [Deploying to Vercel](#deploying-to-vercel-step-by-step)
- [Configuration](#configuration)
- [Using it](#using-it)
- [The API](#the-api)
- [Limits](#limits)
- [History](#history)
- [Project layout](#project-layout)
- [Security](#security)
- [Testing](#testing)
- [Scripts](#scripts)
- [Documentation map](#documentation-map)
- [Troubleshooting](#troubleshooting)

## Quick start

> **To run RideNote on your own computer you need your own Anthropic API key.** The project does not
> include one, and API keys are not provided or shared. You create one in your own Anthropic account
> (about five minutes, see [Getting an API key](#getting-an-api-key)) and pay only for what you use, a
> fraction of a cent per parse.
>
> **Just want to look?** Use the public demo if you were given a link. It runs on a small, fixed
> budget of about **$5 a month for everyone together**, and that limit is not raised. When it is spent
> the page says so and the demo stays unavailable until the monthly limit renews. To keep going, run it
> yourself as below.

You need **Node.js 20.9 or newer** (`node -v` shows your version; get it from
[nodejs.org](https://nodejs.org/) if not). `.nvmrc` pins 22.

**1. Download the project and install it.** Open a terminal (on a Mac: press Cmd + Space, type
`Terminal`, press Enter) and run these one at a time:

```bash
git clone <this repository>
cd ridenote
npm install
```

**2. Create your own API key** in your Anthropic account. See
[Getting an API key](#getting-an-api-key). Copy the key; the Console shows it only once.

**3. Put your key in a local file.** `.env.local` is git-ignored, so it is never committed:

```bash
cp .env.example .env.local
```

Open `.env.local` in any editor and paste your key after `ANTHROPIC_API_KEY=`, so the line looks like
`ANTHROPIC_API_KEY=sk-ant-...`. No quotes, no spaces. Save the file.

**4. Start it.**

```bash
npm run dev
```

When the terminal says `Ready`, open **http://localhost:3000**, click **Use an example**, then
**Parse**. A card for "Mrs. Lee" should appear. To stop the app, press Ctrl + C in the terminal.
Next time, only `cd ridenote` and `npm run dev` are needed.

**On a Mac and prefer not to keep the key in a file?** Skip step 3 and run `npm run dev:key` instead of
`npm run dev`. The first time it asks for your key (paste it; nothing is shown) and saves it in your Mac's
Keychain, so you are never asked again. See
[Storing the local key on a Mac](#storing-the-local-key-on-a-mac-no-password-manager).

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
5. Run `cp .env.example .env.local`, open `.env.local`, and paste the key after
   `ANTHROPIC_API_KEY=`. Then run `npm run dev`. (On a Mac you can run `npm run dev:key` instead and
   paste the key when it asks; it is saved in your Keychain.)
6. Open http://localhost:3000, click **Use an example**, then **Parse**.

Menu names in the Console change from time to time; look for "API keys" and "Billing".

### Which workspace and key to use

Workspaces are part of the Anthropic Console. They hold API keys and let you set a monthly spend limit
on each group of keys. Keep **two** for your own projects, with different limits:

| Workspace               | Used for                                                 | Suggested cap      |
| ----------------------- | -------------------------------------------------------- | ------------------ |
| `MarkG-Portfolio`       | Public demos: anything a stranger or manager can trigger | about $5 a month   |
| `MarkG-Portfolio-Local` | Your own development, `.env.local`, `npm run eval`       | $10 to $20 a month |

- Create each key **inside** the right workspace, one per repo and environment (for example
  `ridenote-demo-prod` and `ridenote-local`). Put the demo key only in the host's server-only environment
  variables, and the local key only in `.env.local`.
- Set the workspace spend limit before creating its keys.
- Credit balance is shared by the whole account. Load only what you are willing to lose (about $20 to
  $25 in total) and leave auto-reload off. Leave the Console's "Default" workspace unused.
- Workspaces and Claude _Projects_ (a folder of chats in the Claude app) are unrelated; only workspaces
  affect API keys and spend.

### Storing the local key on a Mac (no password manager)

You do not have to do anything special. `npm run dev:key` looks for your key in the macOS **Keychain**,
the encrypted store built into every Mac, which stays on your computer unless you turned on iCloud
Keychain sync. If it is not there yet, the command asks for it once and saves it. The key is never
written to a file or shown on screen. The Keychain entry is called `ridenote-demo-local`.

These commands all use the saved key, so you never type a key or an entry name:

| Command              | What it does                                                        |
| -------------------- | ------------------------------------------------------------------- |
| `npm run dev:key`    | Start the development server (asks for the key the first time)      |
| `npm run start:key`  | Start the production server (after `npm run build`)                 |
| `npm run eval:key`   | Run the live accuracy eval                                          |
| `npm run key:status` | Say whether a key is saved (never shows it)                         |
| `npm run key:set`    | Save a new key, replacing the old one (for example when it expires) |
| `npm run key:remove` | Delete the saved key                                                |
| `npm run key`        | List these commands                                                 |

Good to know:

- Paste the key when asked (Cmd + V). Nothing appears as you paste. That is normal.
- It only accepts something that starts with `sk-ant-`. Anything else is refused and nothing is saved.
- macOS may ask once whether Terminal can use the item. Choose Allow.
- If you also have a key in `.env.local`, the two do not clash: the `:key` commands use the Keychain,
  and plain `npm run dev` uses the file.
- While the app runs, the key is in that one process's environment. That is safer than a file on disk
  but not invisible to other programs you run as the same user.
- Keys are replaceable, so there is nothing to back up. If you lose the Mac, delete the key in the
  Console and make a new one.
- Advanced: to keep a second key under another name (for example for a different project), put
  `RIDENOTE_KEYCHAIN_SERVICE=my-other-name` in front of any of these commands.

Prefer a vault app that is not tied to a company's cloud? KeePassXC keeps an encrypted file on your own
disk. For this project the Keychain is simpler.

### Keys on Vercel

- Add the demo key under Settings, Environment Variables, for **Production** only, and mark it
  **Sensitive**. Leave Preview and Development empty, or give them a separate low-limit key, so pull
  request builds cannot read the production key.
- It is a different key from your local one, so nothing needs switching: the machine decides which
  one is used. Your Mac uses the Keychain key; Vercel uses its own.
- You do not need to rotate on a schedule. Rotate when a key may have leaked or someone who had it no
  longer needs it: create a new key in the Console, replace the value in Vercel, **redeploy** (a changed
  variable only applies to new deployments), confirm the demo works, then delete the old key.

Keep the key safe:

- Never commit it, paste it into an issue, a chat or a screenshot, or put it in code. `.env.local` is
  git-ignored and the pre-commit hook refuses env files.
- Never give it a `NEXT_PUBLIC_` prefix. Next.js would send it to every visitor's browser.
- If it leaks, delete it in the Console and make a new one. That is the only real fix.
- Use a different key for each person and each environment, so one can be revoked on its own.

## Sharing or deploying a demo

Someone who only wants to _see_ RideNote should not have to create a key, and nobody should be handed
one.

- **Host it.** Deploy the app (for example on Vercel) and store the key as a **server-only**
  environment variable, using a key made for the demo with a low spend limit (this project uses $5 a
  month). Visitors open a URL and click Parse. They never see the key. The app's per-client limit
  (3 requests a minute on the live site, 10 elsewhere), shared budget, 1,000 character note limit and 600 token answer cap keep
  what anyone can do through it small.
- **Don't hand out keys.** A key can be used directly against the API, up to its cap, not only through
  this app. Anyone who wants to go beyond the demo creates their own key in their own account and runs
  the project themselves (Quick start above). The site's Contact page says this too.
- **Keep the demo's limit fixed.** It is the most the demo can ever cost. When it is used up, the parser
  shows "This demo has used up its AI budget" (the API answers 503 with code `out_of_credit`) and the
  server log says `parse failed: out of credit`. The demo stays unavailable until the monthly limit
  renews, and visitors are pointed to running it with their own key.
- **Watch it.** Check usage in the Console now and then, and delete the key if anything looks wrong.

### Deploying to Vercel, step by step

1. Push the repository to GitHub.
2. In Vercel choose **Add New, Project**, import the repository, and keep the detected **Next.js**
   settings.
3. Before the first deploy, open **Environment Variables** and add one:
   - **Name:** `ANTHROPIC_API_KEY` (exactly this, with underscores).
   - **Value:** the demo key, created in the workspace with the small monthly spend limit.
   - **Environments:** tick **Production** only, and mark it **Sensitive**.
4. Click **Deploy**. Every later push to `main` deploys automatically.
5. Check it: open the site, click **Use an example**, then **Parse**. Opening `/api/parse` in the browser
   should show a blank 405 page (the API only accepts POST). In Terminal, `curl -sI <your-url>` should
   show a `content-security-policy` header and **no** `x-powered-by` header.
6. Changing a variable later only affects **new** deployments, so redeploy after changing the key.
7. Keep an eye on usage in the Anthropic Console. If the demo budget runs out, visitors see a clear
   message and the demo stays off until the limit renews.

If a deploy complains that `maxDuration` is above your plan's limit, lower the `maxDuration` line in
`app/api/parse/route.ts` to the limit your plan allows.

## Configuration

Secrets live in environment variables, never in code. `.env.local` is git-ignored; `.env.example` is
the committed template.

| Variable                     | Required        | What it does                                                                                                                                   |
| ---------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`          | yes             | Your key. Read only on the server, never sent to the browser.                                                                                  |
| `MODEL`                      | no              | Claude model to use. Defaults to `UPSTREAM.defaultModel`. If another model rejects the request, see the `thinking` setting in `lib/config.ts`. |
| `HISTORY_DATABASE_URL`       | production only | Connection string for the `history_app` role (insert and read). Turns History on. Leave it unset everywhere else. See [History](#history).     |
| `HISTORY_PURGE_DATABASE_URL` | production only | Connection string for the `history_purge` role (read and delete), used only by the daily clean-up.                                             |
| `CRON_SECRET`                | production only | A long random string. Vercel sends it to the clean-up route, which refuses any caller without it.                                              |

Every other tunable number (limits, timeouts, status codes) lives in **`lib/config.ts`**, and every
piece of user-facing text in **`lib/messages.ts`**. Change them there, not in the code that uses them.

## Using it

The site has five sections, reachable from the navigation on the left (a **Menu** button on phones):

| Page             | Path            | What it is                                                                           |
| ---------------- | --------------- | ------------------------------------------------------------------------------------ |
| **Parser**       | `/`             | The tool itself.                                                                     |
| **Requirements** | `/requirements` | The PRD, required input, expected JSON output and what valid JSON is.                |
| **Docs**         | `/docs`         | Setup, accepted and rejected inputs, JSON pitfalls, every error explained.           |
| Docs: **Eval**   | `/docs/eval`    | How the live accuracy eval works, with every case listed.                            |
| Docs: **FAQ**    | `/docs/faq`     | Common questions, and the bugs found along the way with their lessons.               |
| **Contact**      | `/contact`      | How to reach the owner on GitHub with questions or feedback (keys are not provided). |
| **Tests**        | `/tests`        | Every automated test name, read from the real test files at build time.              |

What to type, in short: who, where from, where to, when, and mobility: name every aid the passenger
uses (a wheelchair, a cane, a walker, and so on) and all of them are returned as a list. The card shows
the time as **9:30 AM**; the API returns it as 24-hour `09:30`, exactly as written (no time zone conversion). A state or zip is
optional. A note with none of these is still
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

`mobility` is a list of every aid the note names: any of `wheelchair`, `stretcher`, `walker`, `cane`,
`crutches`, `scooter` or `other`, or `["ambulatory"]` for someone who walks unaided, or `[]` when the
note does not say. The AI sorts plain words into these (a rollator is a `walker`, a gurney is a
`stretcher`). If no aid is named, `mobility` is `[]` and the server adds `"mobility"` to `missing_fields`.
The card does not show that as an amber chip (most notes name no aid, and a warning on nearly every card
would be ignored). It shows a quiet line beside Mobility instead: "Mobility not stated. Confirm before
dispatching." Not stated is not the same as needs none, so say "walks unaided" when that is what you
mean. `pickup_time` is 24-hour `HH:MM` with no AM or PM, so 3pm is `15:00`; the card turns it into 12-hour for
reading, and the data underneath never changes. The time is **exactly what the note says**: there is no
time zone handling, so nothing is converted to server time or any other zone, and a zone named in the
note ("3pm EST") is only repeated in `notes`. There is no date field either.

Errors are JSON too: `{ "error": "human readable message", "code": "required" }`. The Docs page
explains each status and each validation code.

## Limits

All in `lib/config.ts`. The reasoning behind each number is in [docs/SCALING.md](docs/SCALING.md).

| Limit                 | Value                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| Note length           | 5 to 1,000 characters (trimmed)                                                                    |
| Request body          | 8 KB                                                                                               |
| Per client            | 3 requests a minute on the live site (production), 10 requests a minute in development and preview |
| All clients together  | 300 AI calls per minute                                                                            |
| Simultaneous AI calls | 10 per server                                                                                      |

## History

The **History** page lists the trips people have parsed on the live site. It is public and read only,
and it exists only on the production deployment: in development and preview it says so, and nothing is
saved.

**What is saved.** After a successful parse the app saves the parsed trip's name, pickup and dropoff
location, pickup time and mobility aids, plus the call's input tokens, output tokens and latency in
milliseconds (shown on its History card). It never saves the note you typed, the `notes` sentence or the
missing list. A trip with nothing in it (no name, no address, no aid) is not saved.

**Who can see it, and for how long.** Anyone can open `/history`. Entries are deleted after 7 days by a daily
clean-up (`vercel.json` cron calling `/api/history/purge`, which refuses any caller without `CRON_SECRET`).
The parser page tells visitors this next to the Parse button and asks for made-up names.

**The scrubber and its honest limit.** Before saving, phone numbers, email addresses and similar contact
patterns are replaced with `[removed]`. A pattern cannot judge meaning: a real name or home address typed
into the note is still saved if it looks like ordinary text. The visitor notice and the 7-day deletion are
the safeguards.

**Moderation.** The app cannot edit or delete a row. If someone saves something rude or someone else's real
details, remove it by hand: in the Neon console open the SQL editor as the owner and run
`delete from history where id = 123;` (find the id with a `select`).

**Flood protection, in layers.** Writes happen only after a successful parse, so every layer that protects
the paid call also bounds the database.

1. Vercel's automatic DDoS mitigation (every plan, unbilled).
2. An edge rate-limit rule on `POST /api/parse` (set in the dashboard, below). It refuses the fourth request
   a minute from one address before any code runs.
3. The in-app limiter: **3 requests a minute** per client in production and **10 requests a minute** in
   development and preview, counting every request, valid or not. It counts per server instance, so it is
   a backstop behind the edge rule.
4. The size cap, validation, the shared budget and the concurrency cap, then the spend limit on the API key.
5. A daily save cap (`HISTORY.dailySaveCap`, 2,000 rows) inside the insert: past it, parsing carries on and
   saving stops. The 7-day clean-up bounds the table's size.
6. The History page is cached for a minute, so page views do not each hit the database.

Limits: many people can share one address (an office or a school), so colleagues trying the demo at the same
moment can be refused for a minute. A large botnet where every address stays under the limit is not stopped
by a per-address rule; layers 1, 4 and 5 bound the damage.

### Setting up History on Vercel

The full beginner walkthrough, with the exact Neon and Vercel clicks, the connection-string recipe, the
Firewall rule and the troubleshooting table, is in **[docs/HISTORY-SETUP.md](docs/HISTORY-SETUP.md)**. In
short, once and in order:

1. Add the **Neon** integration under Vercel **Storage**.
2. Run `db/schema.sql` as the owner in the Neon SQL editor (table, two roles, self-check). A database from
   before the usage columns needs `db/migrations/2026-10-28-history-usage.sql` run once instead, **before**
   deploying the code that writes them. Optionally prove the grants with `db/verify.sql`.
3. Set each role's password with `alter role`, then build the two connection strings from the owner's pooled
   string (swap user and password, drop `&channel_binding=require`).
4. Add `HISTORY_DATABASE_URL`, `HISTORY_PURGE_DATABASE_URL` and `CRON_SECRET` in **Settings, Environment
   Variables** (Production only, Sensitive), then redeploy.
5. Add the Firewall rule on `POST /api/parse` (IP key, 60 s window, limit 3), action Log first, Deny later.
6. Check **Settings, Cron Jobs** and the logs for the 04:00 purge run.

**Check after each deploy:** from one machine send five quick parses (the example note, Parse, five times
within a minute). The fourth should be refused with "You're going a bit fast", and `/history` should list
three entries.

### Querying History from a Mac

Only the live site saves anything, so there is nothing to query locally. Rows older than 7 days are gone.

1. Install the client: `brew install libpq`, then add `$(brew --prefix libpq)/bin` to your `PATH`. (Or paste
   queries into the Neon console SQL editor and skip this.)
2. Copy `HISTORY_DATABASE_URL` from the Vercel project's environment variables (or the Neon console). It is
   the insert-and-read role, so a slip at the terminal cannot change or delete data. It is a secret: do not
   commit it or paste it into chat.
3. Connect with `psql "$HISTORY_DATABASE_URL"` (export it in that Terminal window first).

Example queries:

The latest 20 entries:

```sql
select created_at, passenger_name, pickup_location, dropoff_location, pickup_time, mobility
from history order by created_at desc limit 20;
```

Everything from one pickup location:

```sql
select created_at, passenger_name, pickup_location, dropoff_location, pickup_time, mobility
from history where pickup_location ilike '%airport%' order by created_at desc;
```

Trips that need a wheelchair:

```sql
select created_at, passenger_name, pickup_location, mobility
from history where 'wheelchair' = any(mobility) order by created_at desc;
```

How many trips per pickup location:

```sql
select pickup_location, count(*) as trips
from history group by pickup_location order by trips desc;
```

Entries in a date range:

```sql
select created_at, passenger_name, pickup_location
from history where created_at between now() - interval '3 days' and now() - interval '1 day'
order by created_at desc;
```

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

## Security

The project is built so that the one secret it holds (the API key) stays on the server, and so that a
visitor can only do a small, bounded thing: send one short note and get one structured trip back.

- **The key** is read only on the server and is never in the repository or the browser. A test scans every
  tracked file, and a pre-commit hook refuses env files.
- **Input** is validated first (length, hidden characters, HTML and script links) and the request body is
  size-capped while it is read.
- **The AI** gets the note escaped inside its own tags. Its answer is checked against a strict schema,
  and the live eval includes notes that try to give it instructions.
- **The browser** gets a Content-Security-Policy, HSTS in production, no framing, a strict referrer
  policy, and camera, microphone, location, payment and USB turned off. Text is always escaped.
- **History** saves only the parsed trip (never the note), with contact details removed, for 7 days. The
  app role can insert and read but not delete; a separate role does the daily clean-up.
- **Cost** is capped by per-client and shared limits, a short answer cap and, most importantly, a small
  fixed spend limit on the demo's API key.
- **Dependencies** are installed from a lockfile with scripts disabled, audited in CI, and kept current
  by Dependabot.

Found a problem? See [SECURITY.md](SECURITY.md) for how to report it and for the known limits.

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

A pre-commit hook runs `npm run check`. CI runs everything on every push, from a clean checkout: the
`typecheck` script runs `next typegen` first because Next.js generates some types into `.next/`, which
is not in git.

## Scripts

| Script                                          | Does                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                                   | Development server with hot reload                                |
| `npm run dev:key`                               | Same, with the key read from the Mac Keychain (asks once)         |
| `npm run start:key` / `eval:key`                | Production server / live eval, with the Keychain key              |
| `npm run key:status` / `key:set` / `key:remove` | Check, replace or delete the saved key (`npm run key` lists them) |
| `npm run build` / `start`                       | Production build and server                                       |
| `npm run lint` / `lint:fix`                     | ESLint                                                            |
| `npm run format` / `format:check`               | Prettier                                                          |
| `npm run typecheck`                             | TypeScript without emitting files                                 |

## Documentation map

| Read this                                                                 | When you want to                                                                                                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [docs/GUIDE.md](docs/GUIDE.md)                                            | Understand the whole project from scratch                                                                                  |
| [docs/EVAL.md](docs/EVAL.md)                                              | Learn how the live accuracy eval works and how it ties into prompt and schema                                              |
| [docs/FAQ.md](docs/FAQ.md)                                                | See common questions and **the bugs we hit and what they taught us**                                                       |
| [docs/BEST-PRACTICES.md](docs/BEST-PRACTICES.md)                          | Learn the habits this code is built on                                                                                     |
| [docs/SUBAGENTS.md](docs/SUBAGENTS.md)                                    | Learn, step by step, how a feature was planned and built with a team of AI subagents (also on the site under Docs, Agents) |
| [docs/HISTORY-SETUP.md](docs/HISTORY-SETUP.md)                            | Set up the History database on Neon and Vercel, step by step, with troubleshooting                                         |
| [The History design](docs/superpowers/specs/2026-10-27-history-design.md) | Read the approved design of the History feature, with the options weighed                                                  |
| [The History plan](docs/superpowers/plans/2026-10-27-history.md)          | Read the task-by-task plan that was executed to build it                                                                   |
| [SECURITY.md](SECURITY.md)                                                | Report a problem, and see what is protected and the known limits                                                           |
| [docs/SCALING.md](docs/SCALING.md)                                        | Understand cost, limits and abuse protection, and what to add for production                                               |

This repository uses Next.js 16, which differs from older versions. See `AGENTS.md`: read the guides in
`node_modules/next/dist/docs/` before changing framework-level code.

## Troubleshooting

| Symptom                                       | Likely cause and fix                                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| "This demo has used up its AI budget"         | The demo's fixed monthly limit is spent. It stays off until the limit renews. Run RideNote yourself with your own key (Quick start).               |
| "We couldn't parse that note" every time      | Missing or wrong `ANTHROPIC_API_KEY`. The terminal shows `parse failed: <ErrorType>`.                                                              |
| 429 while testing by hand                     | You passed the per-client limit (3 a minute on the live site, 10 a minute locally). Wait for `Retry-After` seconds.                                |
| Everyone shares one rate limit locally        | Normal in dev: no proxy headers, so all clients look the same. See the FAQ.                                                                        |
| `npm run test:e2e` cannot launch a browser    | Run `npx playwright install chromium` once.                                                                                                        |
| `npm run dev:key` says it only works on a Mac | It uses the macOS Keychain. Use `.env.local` and `npm run dev` instead.                                                                            |
| History page is empty, or purge does not run  | See the troubleshooting table in [docs/HISTORY-SETUP.md](docs/HISTORY-SETUP.md): usually a variable set for the wrong environment, or no redeploy. |
| Tests page says it found no test files        | The build must run where the source files exist. See the FAQ.                                                                                      |
