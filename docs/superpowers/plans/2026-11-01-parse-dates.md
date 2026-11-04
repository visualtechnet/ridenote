# Plan: dates for Parse (Phase 2 of the dispatch agent design)

Date: 2026-11-01. Spec: `docs/superpowers/specs/2026-10-29-dispatch-agent-design.md`, section "Dates
and times" and the Phase 2 row of "Phasing". Done when `npm run check` and `npm run eval` are green.

## Scope

Add `pickup_date` to the trip, resolve relative dates against an injectable clock, check the result in
code, leave a vague time blank with a reason, migrate History, and add the dated eval cases. Nothing
from Phases 1, 3 or 4 (no agent script, route, tools or evals).

## Steps (each one test first)

1. `lib/config.ts`: `DATES` (default zone, zone length cap, 60-day window).
2. `lib/clock.ts`: `Clock`, `resolveTimeZone`, `localDate`, `isRealDate`, `weekdayOf`, `addDays`.
3. `lib/dates.ts`: `namedWeekdays`, `checkPickupDate` (real, in window, on the named weekday; reason
   strings in `lib/messages.ts`).
4. `lib/trip.ts`: `pickup_date` (YYYY-MM-DD or null) before `pickup_time`; not a required field, so
   it is never a Missing chip.
5. `lib/prompt.ts`: `systemPrompt(clock)` adds "Today is Monday, 2026-11-02 (America/New_York)";
   date rules replace "There is no date field"; a part of the day with no hour is not a time.
6. `lib/extract.ts`: takes `{ clock }`, runs the date check after validation, puts a cleared date's
   reason first in `notes`.
7. `lib/validation.ts` and `app/api/parse/route.ts`: optional `timeZone` in the body, resolved or
   defaulted, never echoed; the route is the only place that reads the system clock; the coalescer
   key includes the zone.
8. `lib/api-client.ts`: the browser sends its IANA zone.
9. History: `pickup_date` in the record, the store (`$4::date` in, `to_char` out), the memory store,
   `db/schema.sql`, `db/migrations/2026-11-01-pickup-date.sql`; the History page shows it.
10. `components/TripCard.tsx`: "Pickup date" field; when null, "Not stated" plus the quiet line "Date
    not stated. Confirm before dispatching." `lib/format.ts`: `formatDate`.
11. Evals: `CLOCK` pinned to Monday 2026-11-02 in New York; ten date cases; the scorer checks
    `pickup_date` (string, pattern or null).
12. Docs: README, FAQ, EVAL, HISTORY-SETUP, the Docs and Requirements pages, the sample responses.
13. `npm run check`, `npm run test:coverage`, `npm run eval:key`, `npm run test:e2e`.
