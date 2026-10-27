# History of parsed results, with abuse protection (design)

Date: 2026-10-27. Status: **approved by Mark, 2026-10-27, with the recommended defaults** (see "Decisions for Mark",
now settled). The next step is the build plan.

Revised after Mark's latest answers: store in Postgres **only on production**; save **only the parsed result**
(never the raw note); the History page lists what was saved; delete after 7 days; the page does **not** describe
"what we've done so far" (dropped); and security and scale are part of the design, including a rate limit so
that three or more notes from one place within a minute is treated as an attack and refused.

## Intent and why

A visitor opens the live demo, types a dispatcher note, and RideNote parses it into a trip: passenger, pickup,
drop-off, pickup time and mobility aids. Mark wants every successful parse on the **production** site kept in
Postgres and shown on a public, read-only **History** page, so anyone can see what the demo has been parsing.
Entries disappear after 7 days. Nothing needs a password.

Because the demo is public and open to anyone, the design has two jobs: do the feature, and make sure a flood of
requests (an attack or just a bug) can neither break the site, run up the AI bill, nor fill the database.

## Goals

- Every successful parse on the Vercel **production** deployment saves one record to Postgres: the passenger
  **name**, **pickup address**, **drop-off address**, **pickup time** and **mobility aids**, plus the time it was
  saved. Emails, phone numbers and other personal identifiers are removed before anything is saved.
- A public `/history` page lists the records from the last 7 days, newest first.
- Records older than 7 days are deleted automatically.
- The history is read-only for visitors and for the app; the database enforces it.
- **From one IP address, a fourth parse in a minute is refused, before any AI call or database write** (see
  "Abuse protection", where the exact threshold is Mark's to confirm). The rule is enforced at the edge, in front
  of the app.
- A database outage, slow write or missing setting never slows down or fails a parse.
- Mark can query the data from his Mac (for example, all entries from one pickup location).
- Requirements, docs, FAQ, security summary, README and tests are updated with the feature.

## Non-goals

- Saving anything outside Vercel production (local dev, `next start` and preview deployments save nothing and
  need no database).
- Saving the raw note. Only the parsed fields above are saved (an allow-list, so a field added to the trip card
  later is not saved by accident).
- Saving the model's free-text `notes` line or `missing_fields`.
- Editing, manual deleting, exporting, searching or filtering on the page.
- Recording who typed the note: the app has no sign-in, so the only name available is the passenger's.
- Saving failed parses or refused requests.
- A password or any sign-in.
- "What we've done so far": a description of project work on the page. Dropped by Mark.
- Defending against a very large distributed attack on our own. Vercel's platform does that (see Constraints);
  this design adds the layers the app controls.

## Anti-goals (a failure even if it technically works)

- A flood of requests running up the AI bill or the database, or taking the site down.
- A database outage, slow write or missing setting slowing down or failing a parse.
- An email address, phone number or other personal identifier reaching the database or the page, including one
  written inside the name or an address field.
- Scrubbing so aggressive that normal street numbers, zip codes or times are blanked out.
- A path that lets a visitor or the parse route change or delete records. The only deleting code is the clean-up
  job, behind its own secret and its own database role.
- Records older than 7 days still showing on the page because the clean-up lagged.
- A refusal that tells a real visitor "we couldn't parse that note" instead of "you're going too fast".
- Visitors not knowing that what they type is saved and shown publicly.

## Constraints

- Next.js 16 (`AGENTS.md`: read `node_modules/next/dist/docs/` before writing code). `after()` from
  `next/server` runs work after the response is sent and is allowed in Route Handlers.
- Vercel no longer offers its own Postgres. Postgres comes from a Marketplace integration (Neon); the
  integration injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` with the owner's credentials.
- Vercel Cron Jobs are available on every plan, but on Hobby they can run only once per day, with timing
  precision of about an hour. A daily clean-up fits; an hourly one would fail deployment on Hobby.
- **Vercel gives every plan automatic DDoS mitigation**, and does not bill traffic it blocks
  ([DDoS Mitigation](https://vercel.com/docs/vercel-firewall/ddos-mitigation)).
- **Vercel WAF Rate Limiting is available on all plans**
  ([WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), last updated
  2026-08-28). On Hobby: counting keys are **IP** and **JA4 digest**; fixed-window counting; a window of 10
  seconds to 10 minutes; **one rate-limit rule per project** (within 3 custom rules); 1,000,000 allowed requests
  included. Actions: default 429, Log (no blocking, for trials), Deny, Challenge. Rules are set in the
  dashboard (Firewall, New Rule, then Review Changes and Publish). **Counters are tracked per region**, so
  traffic from one source spread over several regions can exceed the limit that any one region enforces.
- The app's own rate limiter and budget live in process memory, so on serverless each instance counts
  separately. They cannot enforce a limit across the whole site (`lib/rate-limit.ts` says so).
- The repo keeps tunables and URLs in `lib/config.ts` and `lib/routes.ts`, user-facing strings in
  `lib/messages.ts`, and logs error types only (never entry contents).
- The test catalog (`lib/test-catalog.ts`) reads test files automatically; the Requirements and Docs pages
  are hand-written pages with tests of their own.
- The site's current promise, in the README, Docs, Contact page and `SECURITY.md`, is that notes are **not
  stored**. This feature reverses it, so those statements must change.

## Approaches considered

### 1. Talking to Postgres (chosen by Mark)

- **Neon serverless driver, plain SQL (chosen by Mark).** One small dependency (`@neondatabase/serverless`), one
  table, hand-written queries in a `lib/` module, matching the repo's style.
- Drizzle or Prisma ORM: heavy for one table. Not chosen.
- Standard `pg` driver: needs more care with pooling on serverless. Not chosen.

### 2. Weekly deletion (my call)

A Vercel Cron Job calling a protected route, rather than a database-side schedule (`pg_cron`), because it needs
no database extension and the repo already deploys on Vercel.

### 3. Stopping floods (new; **Mark to pick**)

The problem: "from one IP, three or more notes in a minute is an attack, so refuse." The app is serverless, so a
counter in memory cannot see the whole site. Four ways to get a counter that does:

| Option                                                                | How it works                                                                                                      | For                                                                                                                                                                                                                                                                               | Against                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Vercel WAF rate-limit rule (edge)**                              | One rule on `POST /api/parse`: key IP, 60-second fixed window, limit 3, action Deny or 429. Set in the dashboard. | Enforced **before any code runs**, so a refused request costs no function time, AI call or database write. Shared across all instances. No new service or dependency. Available on Hobby. Built-in dashboard shows what it blocked, and a Log mode lets us watch before blocking. | Hobby allows **one** rule, so it is spent on this route. Counters are per region. A fixed window means up to 2 x limit can slip through at a window boundary. The refusal is Vercel's 429, not our JSON. No escalation (for example a 10-minute ban). Set by hand in the dashboard, so it is not in the repo. |
| **B. Shared counter in Redis (Upstash, from the Vercel Marketplace)** | App code checks a counter in Redis before doing anything.                                                         | Exact, global count. Any shape of rule: 3 a minute, 20 an hour, an escalating ban. Our own JSON error and `Retry-After`. Lives in the repo and is testable.                                                                                                                       | A new service, dependency and secret. A network call on every request (a few ms). Free-tier limits. The attack still reaches our function before it is refused, so it still costs function time.                                                                                                              |
| **C. Counter in Postgres (Neon)**                                     | Same as B, using a table.                                                                                         | No new service.                                                                                                                                                                                                                                                                   | Every request, including attack traffic, hits the database, which makes the database the thing that is attacked. Slowest. Not recommended.                                                                                                                                                                    |
| **D. In-memory only (today)**                                         | Keep what exists.                                                                                                 | Free. Works for local development.                                                                                                                                                                                                                                                | Does not enforce a limit across instances, so it cannot stop an attack on a serverless host.                                                                                                                                                                                                                  |

**Recommendation (my call, for Mark to confirm):** **A as the front door, with the existing in-app layers
kept behind it** (D, the shared budget, the concurrency cap and the spend limit on the key). It enforces
exactly the rule Mark described, at the edge, for free, with no new moving parts. Add B later only if Mark wants
hourly limits or escalating bans, or the one-rule limit on Hobby becomes a problem. If the project is on Pro,
A has 40 rules and the trade-off against B shrinks further.

## Design

### Where saving is on

`lib/history.ts` exposes `historyEnabled()`: true only when `process.env.VERCEL_ENV === "production"` and
`HISTORY_DATABASE_URL` is set. Save, page query and clean-up all check it first, so local and preview behave
identically: no database connection is ever opened.

The module talks to a small store interface (`insert`, `list`, `purgeOlderThan`). The real store uses the Neon
driver. For e2e only, `HISTORY_STORE=memory` (never set on Vercel) swaps in an in-memory fake; the e2e server
also sets `VERCEL_ENV=production` so the gate itself is exercised, not bypassed.

### What is saved

A pure function maps a validated trip card to the record: `passenger_name`, `pickup_location`,
`dropoff_location`, `pickup_time` and `mobility` are copied (null or empty if absent), after the text fields go
through the scrubber below. Nothing else is passed on. A unit test pins the exact keys, so adding a field
requires a deliberate change. **The raw note is never stored, logged or passed to the history code.**

**The scrubber** (`lib/scrub.ts`, a pure function, runs before anything is saved, so sensitive values never
reach the database and the page needs no extra filtering). It replaces each match with `[removed]` in the three
text fields. It removes:

- email addresses;
- phone numbers in common formats (with or without country code, spaces, dots, dashes or brackets);
- long digit runs that look like identifiers (card, account, Social Security style patterns), while leaving
  street numbers, 5-digit zip codes and times alone;
- values that follow identifier labels such as `DOB`, `SSN`, `ID`, `member`, `policy`, `account`, `Medicaid`,
  `Medicare`, `insurance`;
- web links.

Honest limit: this is pattern matching, so it catches the formats above and cannot recognise every kind of
personal detail a person might type. The docs and FAQ say so plainly. The visitor notice, the 7-day deletion and
the narrow allow-list are the other safeguards. The rules are a tested list in one file, so Mark can add a
pattern in one place when he finds something that slips through.

A passenger name and an address are themselves personal details. The design treats them that way: visitors are
told before they submit (below), and the page says entries are public and kept for 7 days.

### Saving

After a successful upstream call in `callModel` (`app/api/parse/route.ts`), call
`after(() => saveEntry(record))`. `callModel` is the coalesced function, so identical simultaneous notes share
one call and produce one saved row. The route runs on Node (no runtime export). The builder must confirm
`after()` works when called from inside `callModel`; if not, call it from `POST` for the request that owns the
upstream call. `saveEntry` runs one `INSERT` and catches every error, logging only the error name. The parse
response never waits for it and never changes because of it. Nothing is saved for a refused, invalid, rate-limited
or failed request, **or for a trip with nothing extracted** (every text field null and no mobility aid): it has nothing worth showing and would only clutter a public page.

### Table

`history(id bigint generated always as identity primary key, created_at timestamptz not null default now(),
passenger_name text, pickup_location text, dropoff_location text, pickup_time text, mobility text[] not null
default '{}')`, with an index on `created_at`. Plain columns (not JSON) so Mac queries stay simple;
`pickup_time` stays the 24-hour `HH:MM` string the card uses. Created by a checked-in `db/schema.sql` that Mark
runs once in the Neon console (no migration tool).

### Read-only enforcement and the one exception

`db/schema.sql` also creates two Postgres roles. Their passwords are set by Mark in the Neon console, never in
the file.

- **App role:** `INSERT, SELECT` on `history`, nothing else. Its connection string is `HISTORY_DATABASE_URL`
  (pooled). The parse route (INSERT), the history page (SELECT) and Mark's Mac queries all use it. It cannot
  `UPDATE`, `DELETE` or `TRUNCATE`.
- **Clean-up role:** `SELECT, DELETE` on `history`, nothing else. Its connection string is
  `HISTORY_PURGE_DATABASE_URL`, read only by the clean-up route.

The Neon-injected `DATABASE_URL` (owner) is not used by the app. The only `DELETE` statement in the code is in
the clean-up module, and a unit test asserts that no `UPDATE`/`DELETE`/`TRUNCATE` appears anywhere else in the
history code.

### Weekly clean-up

A Vercel Cron Job (`vercel.json`) calls `GET /api/history/purge` once a day. The route requires
`Authorization: Bearer $CRON_SECRET` (Vercel sends this header when `CRON_SECRET` is set), rejects anything else
with 401, and deletes rows where `created_at < now() - interval '7 days'` using the clean-up role. It does
nothing outside production. Retention (7 days) is a named constant in `lib/config.ts`. The History page also
filters to the last 7 days itself, so expired rows never show even if a clean-up is late or fails. The builder
should confirm in current Vercel docs how the cron header is checked and that cron runs only on production
deployments.

### History page

`app/history/page.tsx`, a public server component, added to `Routes` and the site navigation, with a `noindex`
robots tag so search engines do not list it. It must **not query the database on every visit**: it is cached
and revalidated on a short interval (for example 60 seconds), so a flood of page views costs one query a
minute, not one per view. The query has a fixed row cap set in `lib/config.ts`.

- Not production: a plain notice that history is recorded only on the production deployment.
- Production: a read-only list, newest first, each row showing the passenger name, pickup address, drop-off
  address, pickup time (12-hour, as the trip card shows it), mobility aids and the saved time, with a line
  saying entries are public, kept for 7 days, and that contact details are removed. The builder should reuse
  the existing `TripCard` formatting where it fits. Empty state when none. No buttons, forms or links that
  change anything. All text is escaped as React does by default.
- Database error: a plain error state; the rest of the site is unaffected.
- **Cache and tests (my call):** the page is cached for 60 seconds on the live site. With `HISTORY_STORE=memory`
  (browser tests only) it is not cached, so a just-saved entry appears at once. The cache setting itself is
  asserted by a component test and checked by hand on production (the docs say how). The browser tests
  therefore do not exercise the real caching.

### Telling visitors (new requirement; my call)

Because the site has promised "not stored", and because names and addresses are personal details, the parser
page shows a short notice near the Parse button, in plain words: results are saved and shown publicly on the
History page for 7 days, so use made-up names and addresses. It is shown on every deployment (so local
behaviour matches), with copy that says saving happens only on the live site.

## Abuse protection and scale (new)

**Principle:** a refused request should cost as little as possible, so refuse as early as possible, with the
cheapest check, before validation, the AI or the database.

### The layers, outermost first

| #   | Layer                                                     | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                          | Where it lives                       |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 0   | **Vercel DDoS mitigation**                                | Absorbs large volumetric floods automatically, unbilled.                                                                                                                                                                                                                                                                                                                                                                                              | Platform, every plan                 |
| 1   | **Edge rate-limit rule (option A)**                       | `POST /api/parse`, key IP, 60 s fixed window. Refuses beyond the limit before any code runs.                                                                                                                                                                                                                                                                                                                                                          | Vercel dashboard (Firewall)          |
| 2   | **In-app per-IP limiter (exists)**                        | The same threshold in code **in production**, as a backstop behind layer 1 (it counts per instance). Preview and local development keep the looser limit (10 a minute) so testing is not painful.                                                                                                                                                                                                                                                     | `lib/rate-limit.ts`, `lib/config.ts` |
| 3   | **Body size cap, content-type check, validation (exist)** | Rejects junk cheaply, before the AI.                                                                                                                                                                                                                                                                                                                                                                                                                  | `app/api/parse/route.ts`             |
| 4   | **Shared budget and concurrency cap (exist)**             | Caps AI calls per minute and in flight, per instance.                                                                                                                                                                                                                                                                                                                                                                                                 | route                                |
| 5   | **Spend limit on the demo's key (exists)**                | The final ceiling on cost, outside the code.                                                                                                                                                                                                                                                                                                                                                                                                          | Anthropic Console                    |
| 6   | **Database protections (new)**                            | Writes happen only after a successful parse, so layers 1 to 5 also bound database writes. A **daily save cap** (a named constant, for example 2,000 rows a day) is enforced inside the INSERT itself: it inserts only if fewer than that many rows were saved in the last 24 hours (one statement, no extra round trip), so if something gets through, saving stops, parsing does not. The 7-day purge bounds total size. The app role cannot delete. | `lib/history.ts`                     |
| 7   | **Cached history page (new)**                             | Page views do not hit the database one-for-one.                                                                                                                                                                                                                                                                                                                                                                                                       | `app/history/page.tsx`               |

### The rule Mark described

"If three or more notes are entered from one place within a minute, we are being attacked."

- **Key:** the client's IP address, as the platform reports it (`x-real-ip`; never the first
  `x-forwarded-for` entry, which a client can write, as `app/api/parse/route.ts` already explains). The app has
  no sessions, and a session cookie is easy for an attacker to discard, so the IP is the key that matters.
- **Window and limit:** 60 seconds, **a fourth request is refused** (three are allowed). Mark's words,
  "three or more", could also mean the third is refused. This is Mark's to confirm (see Decisions). It is one
  constant in `lib/config.ts` and one number in the dashboard rule.
- **What counts:** every `POST /api/parse`, valid or not, so junk traffic is throttled too.
- **Where the number applies:** the edge rule enforces it on the live site. The in-app limiter uses the same
  number in production only (`RATE_LIMIT.maxRequests`, one constant, documented). In local development and on
  preview it stays at 10 a minute, because local testing at 3 a minute would be painful. The docs and the
  test that checks docs against config say so. The browser tests run against a dev server with the looser
  limit, except the one "fourth refused" test, which turns the production setting on; the builder must check
  that no other browser test sends more than three real parses from one client in a minute.
- **What a refused visitor sees:** the HTTP 429 and a plain message ("You're going a bit fast. Please wait a
  moment and try again."). The edge refusal is Vercel's response and may have **no JSON body and no
  `Retry-After`**. The current browser code assumes JSON, and for a 429 without a body it would show "We
  couldn't parse that note", which is wrong. **Requirement:** the client maps any 429 to the "slow down"
  message, with or without a body or header. A test covers it.
- **Shared addresses:** an office, school or phone network can put several real people behind one IP. At three a
  minute, colleagues trying the demo at the same moment can be refused. The message tells people to wait a
  minute. Accepted trade-off, stated in the docs.
- **Escalation:** none in option A. If Mark wants a temporary ban after repeated violations, that is option B.

### Rolling it out safely

1. Deploy the code, then create the edge rule with the action set to **Log**. Watch the Firewall overview for a
   few days to see real traffic against the rule.
2. Switch the action to **Deny / 429** once the numbers look right.
3. The in-app limiter is already enforcing the same threshold, so there is no window with no protection.

### Scale, in numbers

- A saved row is about 200 bytes. At the daily cap of 2,000 rows for 7 days, the table holds at most about
  14,000 rows, a few megabytes, far below any free-tier database limit.
- Database writes are bounded by the number of successful parses, which layers 1 to 5 bound. Reads are at most
  one query a minute, because the page is cached.
- Serverless functions scale out on their own. The database is reached through the Neon serverless driver over
  HTTP with the pooled connection string, so many instances do not exhaust connections.
- The per-instance counters (layers 2 and 4) multiply with the number of instances. That is why layer 1 and the
  spend limit, which are global, are the real ceilings.

### Honest limits

- The edge rule counts per region and per fixed window, so a determined attacker can get through a little more
  than three a minute. It slows abuse; it does not make it impossible.
- A large botnet where each address stays under the limit is not stopped by a per-IP rule. The platform's DDoS
  mitigation, the shared budget and the spend limit on the key are what bound the damage, and the daily save cap
  bounds the database.
- Anyone can still read the History page; the page is cached, and Vercel's mitigation covers page floods.
- Pattern-based scrubbing cannot catch every personal detail. The visitor notice and 7-day deletion are the
  safeguards.
- **Anyone can make the public page show text of their choosing** inside the name and address fields:
  rude text, or another person's real details, which pattern scrubbing cannot judge. The app has no way to
  remove a record. The owner can delete a row by hand in the Neon console (owner role), and the docs say how.
  Not saving empty trips, the visitor notice and the 7-day expiry limit the exposure. Mark can choose automatic
  filtering instead (decision 5).

## Querying the database from the Mac (documentation requirement)

The README (and a short FAQ entry) must explain, step by step, how Mark queries production history from a Mac,
for example every entry from one pickup location:

- **Tool:** `psql` from Homebrew (`brew install libpq`, then add it to `PATH`), or the SQL editor in the Neon
  console as a no-install alternative.
- **Connection:** `HISTORY_DATABASE_URL`, the `INSERT`/`SELECT` role, so a slip at the terminal cannot change or
  delete data. Where to copy it from (Neon console, or the Vercel project's environment variables), and to
  connect with `psql "$HISTORY_DATABASE_URL"`. It is a secret: never commit it or paste it into chat. The docs
  follow the repo's Keychain pattern, offering a `scripts/` helper that keeps the URL in the macOS Keychain (like
  the API key) and opens `psql` with it, if the builder judges it fits.
- **Example queries,** each checked against the real table:
  - latest 20: `select created_at, passenger_name, pickup_location, dropoff_location, pickup_time, mobility
from history order by created_at desc limit 20;`
  - by pickup location: `select created_at, passenger_name, pickup_location, dropoff_location, pickup_time,
mobility from history where pickup_location ilike '%airport%' order by created_at desc;`
  - by mobility aid: `... where 'wheelchair' = any(mobility)` (using a real value from the `MOBILITY` list).
  - count per pickup location, and entries in a date range.
- **Reminder:** rows older than 7 days are deleted, so a query can only find the last week.
- Local dev has nothing to query, because saving happens only on Vercel production.

A unit test keeps the documented queries valid: they run against `db/schema.sql` (on an in-memory
Postgres-compatible engine such as PGlite, if it can be added as a dev dependency), or at minimum are checked to
be `SELECT`-only and to use real column names.

## Docs and requirements

- **Requirements page:** what is saved (name, two addresses, pickup time, mobility; nothing else, and never the
  raw note), what is scrubbed, when (production only), that it is read-only, public, kept 7 days, that a database
  failure never affects a parse, and the rate limit (and that it is per IP, with the shared-address caveat).
- **Docs page and README:** the History feature; Neon integration steps on Vercel; running `db/schema.sql`;
  creating the two roles and setting their passwords; the new env vars (`HISTORY_DATABASE_URL`,
  `HISTORY_PURGE_DATABASE_URL`, `CRON_SECRET`); **creating the edge rate-limit rule, step by step, in Log mode
  first**; how to confirm saving, the clean-up and the rate limit work after deploy; Mac querying (above).
- **Replace the "notes are not stored" statements** in the README, Docs page, Contact page, `SECURITY.md` and
  FAQ with the new, accurate description. A test fails if the old wording remains.
- **`docs/FAQ.md` and the security summary:** what is stored, that the page is public, what the scrubber
  removes and that it is best-effort, the 7-day retention, that the only deletion is the automatic clean-up,
  the layers above, and their honest limits.
- `.env.example`: the new variables, with a note that they are production-only.

## Testing

- **Unit:** `historyEnabled()` for every environment combination; the record mapping (exact keys; `notes`,
  `missing_fields` and the raw note never included); the scrubber, with a table of cases: emails, phone formats
  (US and international, dashes, dots, brackets, spaces), SSN/card-style numbers, labelled IDs and DOBs, links,
  and personal details hidden inside the name and address fields; and cases that must be left alone (street
  numbers, zip codes, `Apt 4B`, times); `saveEntry` inserts and swallows failures; the history code contains no
  `UPDATE`/`DELETE`/`TRUNCATE` outside the clean-up module; the 7-day cut-off used by both the page query and the
  purge; the daily save cap stops saving without failing a parse.
- **Rate limit:** the in-app limiter allows the configured number and refuses the next, resets after the
  window, and keys by IP; the threshold in `lib/config.ts` is the one the docs state (a test reads both). The
  edge rule cannot be unit tested, so the docs include a manual check: five quick requests from one machine,
  the fourth is refused.
- **Client:** a 429 with no body and no `Retry-After` shows the "slow down" message, not "couldn't parse".
- **Route:** a parse still returns 200 when the save throws; nothing is saved when history is disabled, when the
  parse fails, or when the request is refused; refused requests make no AI call; the purge route returns 401
  without the right secret, does nothing outside production, and deletes only rows past the cut-off.
- **Component/page:** not-production notice, list order, empty state, error state, expiry and public-notice
  line, no edit or delete controls, `noindex` set, cached (not one query per render).
- **Accessibility:** axe check on `/history` in each state and on the new parser notice, as the repo does for
  other pages, in light and dark mode.
- **E2E:** submit a note that contains a phone number and an email, and find the name, addresses, time and
  mobility on `/history` with the phone number and email absent, using the in-memory store; submit four notes
  from one client in a minute (production setting on) and see the fourth refused with the friendly message and
  nothing saved for it; an empty trip is not saved.
- The repo's docs-consistency tests (docs examples, requirements examples, test catalog, routes) are updated and
  must pass. `npm run check` passes at the end, and the live eval is unaffected (the parse itself does not
  change).

## Left to the builder

File and function names, the SQL for the page query, the row cap and daily save cap values, page revalidation
interval, exact copy for the notices, the Keychain helper (optional), and the e2e fake-store wiring.

## Decisions for Mark (settled: Mark chose "go with your defaults")

1. **Stopping floods:** the Vercel edge rate-limit rule (option A), with the existing in-app layers behind it.
   Redis (option B) is left for later, only if hourly limits or escalating bans are wanted.
2. **Threshold:** three requests a minute from one IP are allowed; the **fourth is refused**.
3. **Visitor notice:** yes. The parser page tells visitors that results are saved and shown publicly for 7 days.
4. **Plan:** Vercel **Hobby** (one rate-limit rule, one daily cron run, which this design fits).
5. **Moderation:** accept the risk. A record is removed by hand in the Neon console when needed; empty trips are
   not saved. Automatic filtering is not part of this build.

## Calls made without Mark

- "What was entered" is read as the trip card's fields (name, pickup, drop-off, time, mobility). The raw note is
  not stored, as Mark confirmed.
- "The name of the person who entered it" is read as the passenger name, because the app has no sign-in.
- The model's free-text `notes` line and `missing_fields` are not saved: free text is where a stray phone number
  or ID is most likely to hide, and Mark did not ask for them.
- Pickup time is saved and shown as it appears on the card.
- Redaction is pattern-based and best-effort; the exact list of patterns is in the design above and is Mark's to
  extend.
- Retention is a rolling 7 days (rows deleted once older than a week), not a wipe on a fixed weekday.
- A daily Vercel Cron Job does the deleting, using a separate delete-only role.
- The page also hides rows older than 7 days itself, and is cached so views do not equal queries.
- `noindex` on the public page.
- Plain columns instead of JSON.
- One row per coalesced upstream call, not per request.
- No migration tool; a single SQL file run by hand.
- A separate `HISTORY_DATABASE_URL` for the restricted role instead of overriding the Neon-injected
  `DATABASE_URL`.
- E2E uses an in-memory store chosen by `HISTORY_STORE=memory`, with `VERCEL_ENV=production` set so the gate is
  still tested.
- A daily save cap, as a second bound on database growth.
- The edge rule is staged: Log first, then Deny.
- The client maps any 429 to the "slow down" message.
- **From the independent builder check:** the in-app limit is strict (3 a minute) in production only, and stays
  at 10 in development and preview, so local testing is not throttled.
- The daily save cap is enforced by a conditional INSERT (one statement), not a separate count query, so a parse
  never waits for an extra read.
- A trip with nothing extracted is not saved.
- The browser tests use an uncached page with the in-memory store; the real caching is asserted separately.
