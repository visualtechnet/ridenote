import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  AGENT,
  BUDGET,
  DATES,
  HTTP,
  LIMITS,
  MOBILITY,
  OUTPUT_LIMITS,
  RATE_LIMIT,
  REQUIRED_TRIP_FIELDS,
} from "@/lib/config";
import { OUTPUT_EXAMPLES } from "@/lib/requirements-examples";
import { Routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Requirements",
  description:
    "The product requirements, required input, expected JSON output and what valid JSON is.",
};

const h2 = "mt-10 scroll-mt-4 text-xl font-semibold text-zinc-50";
const h3 = "mt-6 text-base font-semibold text-zinc-50";
const p = "mt-2 text-zinc-300";
const ul = "mt-2 list-disc space-y-1 pl-6 text-zinc-300";
const code = "px-1 py-0.5 font-mono text-sm bg-zinc-800";
const pre =
  "mt-2 overflow-x-auto bg-zinc-900 p-3 font-mono text-sm text-zinc-50 whitespace-pre-wrap break-words";
const th = "border-b px-3 py-2 text-left font-medium border-zinc-700";
const td = "border-b px-3 py-2 align-top border-zinc-800";
const table = "w-full text-left text-sm text-zinc-200";

const jsonRules = [
  [
    "Six value types only",
    'object { }, array [ ], string "…", number, true/false, null.',
    '{"a": [1, "x", null, true]}',
  ],
  [
    "Strings use double quotes",
    "Single quotes and unquoted keys are invalid.",
    `{'note': 'hi'}  →  invalid`,
  ],
  ["No trailing commas", "A comma must be followed by another item.", '{"a": 1,}  →  invalid'],
  ["No comments", "// and /* */ are not part of JSON.", '{"a": 1 // why}  →  invalid'],
  [
    "Escape special characters in strings",
    'Write a quote as \\", a backslash as \\\\, a line break as \\n, a tab as \\t. Raw control characters (U+0000 to U+001F) are not allowed inside a string.',
    '"line one\\nline two"  →  valid',
  ],
  [
    "Unknown or empty is null, not a blank",
    "Use null for a value that does not exist. undefined, NaN and Infinity do not exist in JSON.",
    '"dropoff_location": null',
  ],
  [
    "Numbers are plain decimals",
    "No leading zeros, no hex, no + sign.",
    '0930 → invalid as a number; use the string "09:30"',
  ],
  [
    "Text is UTF-8",
    "Accents and emoji are fine as they are, or as \\uXXXX escapes.",
    '"Müller 🏥"  →  valid',
  ],
  ["One top-level value", "Exactly one value and nothing after it.", '{"a":1}{"b":2}  →  invalid'],
] as const;

const toolRequirements: readonly (readonly [string, ReactNode])[] = [
  [
    "TC-1",
    "Each tool has a name, a plain description (what it does, when to use it, what it returns, when not to use it) and a JSON schema for its inputs.",
  ],
  [
    "TC-2",
    <>
      Every tool is strict: its schema allows no extra properties and lists every property as
      required (<code className={code}>strict: true</code>).
    </>,
  ],
  ["TC-3", "A tool’s inputs are checked again in code, with Zod, before the tool runs."],
  [
    "TC-4",
    <>
      A tool never throws. A failure comes back as a tool result marked{" "}
      <code className={code}>is_error: true</code>, with a message that says what to try next.
    </>,
  ],
  [
    "TC-5",
    <>
      <code className={code}>find_rider</code> returns at most {AGENT.maxMatches} matches, with only
      the fields the task needs.
    </>,
  ],
  ["TC-6", "When two riders match “Maria”, the agent asks which one and never proposes a trip."],
  [
    "TC-7",
    <>
      <code className={code}>propose_trip</code> takes a <code className={code}>rider_id</code>,
      never retyped facts. The code fills in the name, address and mobility.
    </>,
  ],
  [
    "TC-8",
    <>
      <code className={code}>propose_trip</code> saves nothing. It returns a signed draft and a{" "}
      <code className={code}>draft_id</code>.
    </>,
  ],
  [
    "TC-9",
    "An instruction planted in a rider’s notes, or in the dispatcher’s note, changes no tool call and no draft.",
  ],
  [
    "TC-10",
    <>
      Every tool call prints one <code className={code}>[tool]</code> trace line in the script, and
      one log line in the route. The line holds no inputs and nothing personal.
    </>,
  ],
];

const loopRequirements: readonly (readonly [string, ReactNode])[] = [
  [
    "AL-1",
    <>
      The loop adds the model’s full reply to the conversation, then one user message that answers
      every <code className={code}>tool_use</code> block.
    </>,
  ],
  [
    "AL-2",
    "A run ends only through an ending tool or a named limit. Loose text is never shown as an answer.",
  ],
  [
    "AL-3",
    `Limits: ${AGENT.maxSteps} steps, ${AGENT.maxRunTokens.toLocaleString("en-US")} tokens per run, ${AGENT.maxStepTokens} output tokens per step, ${AGENT.deadlineMs / 1000} seconds per run. All are set in lib/config.ts.`,
  ],
  [
    "AL-4",
    <>
      Every <code className={code}>stop_reason</code> is handled by name:{" "}
      <code className={code}>tool_use</code>, <code className={code}>end_turn</code>,{" "}
      <code className={code}>max_tokens</code>, <code className={code}>refusal</code>, and anything
      unknown.
    </>,
  ],
  [
    "AL-5",
    "The run’s budget is set aside before the first paid call, so a run is never cut off half-way because the budget ran out.",
  ],
  ["AL-6", "Agent runs have their own limit on how many run at once, so they cannot slow Parse."],
  ["AL-7", "The loop stops calling the model when the client disconnects."],
  [
    "AL-8",
    <>
      Every stream ends with an <code className={code}>ended</code> event that carries the status,
      the reason and the usage. A stream without one is shown as failed.
    </>,
  ],
  [
    "AL-9",
    "Only a person’s Approve click saves a trip. Approve checks the signature, the expiry and the schema, and a repeat click does nothing.",
  ],
  [
    "AL-10",
    <>
      The page shows each step as it happens, in a list marked{" "}
      <code className={code}>aria-live=&quot;polite&quot;</code>.
    </>,
  ],
  [
    "AL-11",
    "Each run reports its steps, input, output and cached tokens, its time, and how it ended.",
  ],
  [
    "AL-12",
    "Live agent evals grade the path the agent took (which tools, in what order, and whether it stayed safe). The five critical cases must pass 3 runs out of 3.",
  ],
  [
    "AL-13",
    "Nothing gets worse: npm run check, the browser tests and the parser eval floor (90%, with the critical cases at 100%) stay green.",
  ],
  [
    "AL-14",
    "docs/AGENT.md answers the six “Check yourself” questions, and the eval report records the steps, cost and failures for each case.",
  ],
  [
    "AL-15",
    "Every step of a run is recorded so the run can be replayed: the model’s tool call, the tool result, the tokens and the time. The records hold fixture data only.",
  ],
];

export default function RequirementsPage() {
  const required = REQUIRED_TRIP_FIELDS.join(", ");
  return (
    <div className="flex flex-1 justify-center font-sans">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Requirements</h1>
        <p className={p}>
          What the product must do, what it needs as input, and exactly what it returns. Written
          from what the app does today, and the examples on this page are checked by automated
          tests.
        </p>
        <nav aria-label="On this page" className="mt-4">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-50 underline underline-offset-4">
            {[
              ["prd", "Product requirements"],
              ["input", "Required input"],
              ["output", "Expected output"],
              ["json", "What is valid JSON"],
              ["success", "What makes a parse succeed"],
              ["agent", "The agent"],
            ].map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="inline-flex min-h-11 items-center">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="prd">
          <h2 id="prd" className={h2}>
            Product requirements (PRD)
          </h2>
          <h3 className={h3}>Problem</h3>
          <p className={p}>
            Dispatchers who arrange rides receive trip details as messy free text. Systems need
            structured, labelled fields. Retyping each note by hand is slow and error-prone.
          </p>
          <h3 className={h3}>Goal</h3>
          <p className={p}>
            Turn one free-text dispatcher note into one structured trip record in a few seconds, and
            make anything uncertain or absent obvious so a person can verify it.
          </p>
          <h3 className={h3}>Users</h3>
          <p className={p}>
            Dispatchers and coordinators, not developers. All messages are written for them.
          </p>
          <h3 className={h3}>Functional requirements</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-zinc-300">
            <li>Accept a pasted note and parse it on request (button or Ctrl/⌘ + Enter).</li>
            <li>
              Extract passenger, pickup, dropoff, pickup date, pickup time and every mobility aid
              named (a list).
            </li>
            <li>
              Never invent facts. Anything not stated is null and listed as missing. An empty
              mobility list is also reported in <code className={code}>missing_fields</code>, and
              the card shows a quiet &ldquo;confirm before dispatching&rdquo; line (not an amber
              chip, so the Missing list stays meaningful): walking unaided has to be stated.
            </li>
            <li>
              Do not guess an ambiguous time (an hour with no AM or PM): leave it null and explain
              in the notes. Say so in the notes when a note holds several trips or no trip at all.
            </li>
            <li>
              Show the result as a readable card, with the time in 12-hour form (9:30 AM) and
              missing fields called out. The API keeps the 24-hour time.
            </li>
            <li>Reject unusable input with a clear, specific message before calling the AI.</li>
            <li>Show a friendly message for every failure, and keep the typed note.</li>
            <li>Provide an example note and a Clear action.</li>
            <li>Provide docs, requirements and a test list inside the site.</li>
          </ol>
          <h3 className={h3}>Time rules</h3>
          <ul className={ul}>
            <li>
              <strong>The JSON time is always 24-hour</strong> <code className={code}>HH:MM</code>{" "}
              (00:00 to 23:59), with no AM or PM. Three in the afternoon is{" "}
              <code className={code}>15:00</code>. It cannot be misread, sorts correctly, and suits
              a database.
            </li>
            <li>
              <strong>Only the display changes.</strong> The card shows 12-hour time (9:30 AM, 4:15
              PM) for reading. The data underneath never changes.
            </li>
            <li>
              <strong>No time zones.</strong> The time is exactly what the note says. It is never
              converted to the server&rsquo;s time or any other zone. If the note names a zone (EST,
              Pacific), the clock time is kept as written and the zone is only repeated in the
              notes.
            </li>
            <li>
              <strong>A pickup date is resolved and checked.</strong> Relative wording
              (&ldquo;tomorrow&rdquo;, &ldquo;Friday&rdquo;, &ldquo;11/20&rdquo;) is resolved
              against today&rsquo;s date in the dispatcher&rsquo;s time zone. Code then checks it: a
              real date, the same as any numeric date the note writes, from today to{" "}
              {DATES.maxDaysAhead} days ahead, on the weekday the note names. If a check fails the
              date is null and the reason is put in the notes. When no date is given the card shows
              a quiet &ldquo;Date not stated&rdquo; line, never a Missing chip.
            </li>
            <li>
              <strong>Never guessed.</strong> A time with no AM or PM and no clue (&ldquo;at
              9&rdquo;) is <code className={code}>null</code>, with a note saying why.
            </li>
          </ul>
          <h3 className={h3}>Non-functional requirements</h3>
          <ul className={ul}>
            <li>
              <strong>Safety:</strong> the output carries a reminder to verify before dispatching.
            </li>
            <li>
              <strong>Privacy:</strong> notes may contain personal details; the note itself is never
              saved or logged. The parsed trip (name, addresses, time, aids, plus token counts and
              latency) is saved and shown publicly on the History page for 7 days on the live site,
              with phone numbers and emails removed.
            </li>
            <li>
              <strong>Security:</strong> HTML, scripts and hidden characters are rejected; the
              AI&rsquo;s answer is re-validated; the API key stays on the server.
            </li>
            <li>
              <strong>Cost and abuse:</strong> at most {RATE_LIMIT.maxRequestsProduction} parses per{" "}
              {RATE_LIMIT.windowMs / 1000} seconds per client; request bodies over{" "}
              {LIMITS.bodyMaxBytes.toLocaleString("en-US")} bytes are refused. Across all clients,
              at most {BUDGET.maxCallsPerWindow} AI calls per {BUDGET.windowMs / 1000} seconds and{" "}
              {BUDGET.maxConcurrent} at once; beyond that the API answers 503 instead of running up
              cost. If the AI account itself runs out of credit, the API also answers 503 with a
              clear &ldquo;demo budget used up&rdquo; message (code{" "}
              <code className={code}>out_of_credit</code>).
            </li>
            <li>
              <strong>Accessibility:</strong> keyboard operable, labelled controls, screen-reader
              friendly, passes automated axe checks.
            </li>
            <li>
              <strong>Quality:</strong> automated unit, component, accessibility and browser tests;
              coverage floor enforced.
            </li>
          </ul>
          <h3 className={h3}>Out of scope (today)</h3>
          <ul className={ul}>
            <li>
              Accounts or sign-in, editing or deleting saved trips, and sending trips to a dispatch
              system.
            </li>
            <li>
              Time zones. Whatever time the note gives is kept as is: nothing is converted to the
              server&rsquo;s time or another zone.
            </li>
            <li>Splitting addresses into street, city, state and zip.</li>
            <li>Parsing several trips from one note.</li>
          </ul>
        </section>

        <section aria-labelledby="input">
          <h2 id="input" className={h2}>
            Required input
          </h2>
          <p className={p}>
            One piece of text, called the <em>note</em>. In the browser you type it; to the API you
            send it as JSON:
          </p>
          <pre
            className={pre}
          >{`POST ${Routes.api("parse")}\nContent-Type: application/json\n\n{"note": "Pick up Mrs. Lee at 12 Oak St at 9:30am to County Hospital, wheelchair"}`}</pre>
          <div className="mt-4 overflow-x-auto">
            <table className={table}>
              <caption className="sr-only">Rules for the note</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Requirement
                  </th>
                  <th scope="col" className={th}>
                    Rule
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className={`${td} font-normal`}>
                    Type
                  </th>
                  <td className={td}>
                    A string. The body is exactly <code className={code}>{`{"note": string}`}</code>
                    ; extra fields are dropped.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-normal`}>
                    Length
                  </th>
                  <td className={td}>
                    {LIMITS.noteMin} to {LIMITS.noteMax.toLocaleString("en-US")} characters, counted
                    after trimming spaces at both ends.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-normal`}>
                    Characters
                  </th>
                  <td className={td}>
                    Plain text. Letters in any language, digits, punctuation, emoji, line breaks and
                    tabs. No control characters or text-direction overrides.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-normal`}>
                    No markup
                  </th>
                  <td className={td}>
                    No HTML tags, comments, or <code className={code}>javascript:</code> style
                    links.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-normal`}>
                    Request size
                  </th>
                  <td className={td}>
                    Whole request under {LIMITS.bodyMaxBytes.toLocaleString("en-US")} bytes.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-normal`}>
                    Valid JSON
                  </th>
                  <td className={td}>
                    For direct API calls, the body must be valid JSON (see below).
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <h3 className={h3}>What the note should say</h3>
          <p className={p}>
            To avoid empty fields, a note should state:{" "}
            <strong>{required.replaceAll("_", " ")}</strong>. Mobility is optional: name every aid
            the passenger uses (for example a wheelchair, a cane or a walker) and all of them are
            listed; if the note says nothing the list is <code className={code}>[]</code>. A note
            that states none of these is still accepted; it just returns mostly null fields.
          </p>
        </section>

        <section aria-labelledby="output">
          <h2 id="output" className={h2}>
            Expected output
          </h2>
          <p className={p}>
            On success the API answers <code className={code}>{HTTP.ok}</code> with JSON shaped like{" "}
            <code className={code}>{`{"trip": {...}}`}</code>. The trip always has exactly these
            seven keys.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className={table}>
              <caption className="sr-only">Trip fields</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Key
                  </th>
                  <th scope="col" className={th}>
                    JSON type
                  </th>
                  <th scope="col" className={th}>
                    Rule
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    passenger_name
                  </th>
                  <td className={td}>string | null</td>
                  <td className={td}>Max {OUTPUT_LIMITS.name} characters.</td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    pickup_location
                  </th>
                  <td className={td}>string | null</td>
                  <td className={td}>Max {OUTPUT_LIMITS.location} characters.</td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    dropoff_location
                  </th>
                  <td className={td}>string | null</td>
                  <td className={td}>Max {OUTPUT_LIMITS.location} characters.</td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    pickup_date
                  </th>
                  <td className={td}>string | null</td>
                  <td className={td}>
                    YYYY-MM-DD, or null when the note gives no date or the date failed its checks.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    pickup_time
                  </th>
                  <td className={td}>string | null</td>
                  <td className={td}>
                    24-hour <code className={code}>HH:MM</code>, 00:00 to 23:59, exactly as written
                    in the note. No AM or PM, no time zone, no conversion.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    mobility
                  </th>
                  <td className={td}>array of strings</td>
                  <td className={td}>
                    Every aid the note names, each one of {MOBILITY.join(", ")}, no repeats, never
                    null. <code className={code}>[]</code> when not stated.{" "}
                    <code className={code}>ambulatory</code> (walks unaided) stands alone.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    missing_fields
                  </th>
                  <td className={td}>array of strings</td>
                  <td className={td}>
                    Names of the null required fields, plus <code className={code}>mobility</code>{" "}
                    when no aid is named (not stated is not the same as needs none). Computed by the
                    server. Max {OUTPUT_LIMITS.missingFieldCount} items.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    notes
                  </th>
                  <td className={td}>string</td>
                  <td className={td}>
                    One short sentence about ambiguity, or an empty string. Max{" "}
                    {OUTPUT_LIMITS.notes} characters.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {OUTPUT_EXAMPLES.map((ex) => (
            <div key={ex.title}>
              <h3 className={h3}>{ex.title}</h3>
              <p className="mt-1 text-sm text-zinc-400">Note: {ex.note}</p>
              <pre className={pre}>{JSON.stringify({ trip: ex.trip }, null, 2)}</pre>
            </div>
          ))}
          <h3 className={h3}>Error output</h3>
          <p className={p}>
            Any failure is also JSON, with a human-readable message and, for input problems, a code:
          </p>
          <pre
            className={pre}
          >{`{ "error": "Please enter a dispatcher note before parsing.", "code": "required" }`}</pre>
          <p className={p}>
            Statuses: {HTTP.badRequest} bad input, {HTTP.payloadTooLarge} too large,{" "}
            {HTTP.unsupportedMediaType} not sent as JSON, {HTTP.unprocessable} declined,{" "}
            {HTTP.tooManyRequests} slow down, {HTTP.badGateway} AI or format failure,{" "}
            {HTTP.unavailable} server overloaded. See the Docs page for details.
          </p>
        </section>

        <section aria-labelledby="json">
          <h2 id="json" className={h2}>
            What is valid JSON
          </h2>
          <p className={p}>
            JSON is a text format for data, defined by the standard RFC 8259. A single misplaced
            comma makes the whole document invalid and every program refuses it. Both the request we
            receive and the response we send must follow these rules.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className={table}>
              <caption className="sr-only">JSON validity rules</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Rule
                  </th>
                  <th scope="col" className={th}>
                    Detail
                  </th>
                  <th scope="col" className={th}>
                    Example
                  </th>
                </tr>
              </thead>
              <tbody>
                {jsonRules.map(([rule, detail, example]) => (
                  <tr key={rule}>
                    <th scope="row" className={`${td} font-normal`}>
                      {rule}
                    </th>
                    <td className={td}>{detail}</td>
                    <td className={`${td} font-mono break-all`}>{example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={p}>
            <strong>Valid JSON is not the same as a valid trip.</strong>{" "}
            <code className={code}>{`{"pickup_time": "9:30am"}`}</code> is well-formed JSON but not
            an accepted trip, because the time must be <code className={code}>HH:MM</code>. We check
            both: first that the text is JSON, then that the data has the right shape.
          </p>
        </section>

        <section aria-labelledby="success">
          <h2 id="success" className={h2}>
            What makes a parse succeed
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-zinc-300">
            <li>The request is under the size limit and the client is under the rate limit.</li>
            <li>The body is valid JSON.</li>
            <li>
              The body is an object with a string <code className={code}>note</code>.
            </li>
            <li>
              The note is {LIMITS.noteMin} to {LIMITS.noteMax.toLocaleString("en-US")} characters,
              with no hidden characters or markup.
            </li>
            <li>The AI service is reachable and does not decline.</li>
            <li>The AI&rsquo;s answer matches the trip shape above.</li>
          </ol>
          <p className={p}>
            Success means a well-formed trip came back. It does not mean every field is filled: a
            short note succeeds with null fields and a populated{" "}
            <code className={code}>missing_fields</code>.
          </p>
          <p className={p}>
            A successful response is <code className={code}>{`{ "trip": …, "usage": … }`}</code>.
            The <code className={code}>usage</code> object reports what that one AI call cost:{" "}
            <code className={code}>inputTokens</code>, <code className={code}>outputTokens</code>{" "}
            and <code className={code}>latencyMs</code> (milliseconds spent waiting for the AI
            service). It is shown on the result card and saved with the trip on the History page,
            where each call is rated against the others. Errors carry no usage.
          </p>
        </section>

        <section aria-labelledby="agent">
          <h2 id="agent" className={h2}>
            The agent
          </h2>
          <p className={p}>
            The agent is a second feature beside Parse. It looks up a rider, checks a vehicle, asks
            the dispatcher when something is unclear, and proposes a trip that a person then
            approves. These are the requirements for it, in two groups: how its tools must behave
            (TC) and how its loop must behave (AL). This page says what the agent must do. For what
            is built so far, see{" "}
            <a href={Routes.page("docsAgent")} className="underline underline-offset-4">
              What is built and what is not yet
            </a>{" "}
            in the agent guide.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className={table}>
              <caption className="sr-only">Agent requirements</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    ID
                  </th>
                  <th scope="col" className={th}>
                    Requirement
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...toolRequirements, ...loopRequirements].map(([id, text]) => (
                  <tr key={id}>
                    <th scope="row" className={`${td} font-mono font-normal whitespace-nowrap`}>
                      {id}
                    </th>
                    <td className={td}>{text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
