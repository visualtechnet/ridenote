import type { Metadata } from "next";
import {
  BUDGET,
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

const h2 = "mt-10 scroll-mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50";
const h3 = "mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50";
const p = "mt-2 text-zinc-700 dark:text-zinc-300";
const ul = "mt-2 list-disc space-y-1 pl-6 text-zinc-700 dark:text-zinc-300";
const code = "rounded bg-zinc-200 px-1 py-0.5 font-mono text-sm dark:bg-zinc-800";
const pre =
  "mt-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 font-mono text-sm text-zinc-50 whitespace-pre-wrap break-words";
const th = "border-b border-zinc-300 px-3 py-2 text-left font-medium dark:border-zinc-700";
const td = "border-b border-zinc-200 px-3 py-2 align-top dark:border-zinc-800";
const table = "w-full text-left text-sm text-zinc-800 dark:text-zinc-200";

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

export default function RequirementsPage() {
  const required = REQUIRED_TRIP_FIELDS.join(", ");
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Requirements
        </h1>
        <p className={p}>
          What the product must do, what it needs as input, and exactly what it returns. Written
          from what the app does today, and the examples on this page are checked by automated
          tests.
        </p>
        <nav aria-label="On this page" className="mt-4">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-900 underline underline-offset-4 dark:text-zinc-50">
            {[
              ["prd", "Product requirements"],
              ["input", "Required input"],
              ["output", "Expected output"],
              ["json", "What is valid JSON"],
              ["success", "What makes a parse succeed"],
            ].map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
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
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-zinc-700 dark:text-zinc-300">
            <li>Accept a pasted note and parse it on request (button or Ctrl/⌘ + Enter).</li>
            <li>
              Extract passenger, pickup, dropoff, pickup time and every mobility aid named (a list).
            </li>
            <li>Never invent facts. Anything not stated is null and listed as missing.</li>
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
          <h3 className={h3}>Non-functional requirements</h3>
          <ul className={ul}>
            <li>
              <strong>Safety:</strong> the output carries a reminder to verify before dispatching.
            </li>
            <li>
              <strong>Privacy:</strong> notes may contain personal details; they are not stored and
              are not logged.
            </li>
            <li>
              <strong>Security:</strong> HTML, scripts and hidden characters are rejected; the
              AI&rsquo;s answer is re-validated; the API key stays on the server.
            </li>
            <li>
              <strong>Cost and abuse:</strong> at most {RATE_LIMIT.maxRequests} parses per{" "}
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
            <li>Saving trips, accounts or sign-in, and sending trips to a dispatch system.</li>
            <li>
              A date field. Dates such as &ldquo;tomorrow&rdquo; or &ldquo;Friday&rdquo; are not
              converted; they are repeated in the notes so a person can see them.
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
                    pickup_time
                  </th>
                  <td className={td}>string | null</td>
                  <td className={td}>
                    24-hour <code className={code}>HH:MM</code>, 00:00 to 23:59.
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
                    Names of the null required fields, computed by the server. Max{" "}
                    {OUTPUT_LIMITS.missingFieldCount} items.
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
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Note: {ex.note}</p>
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
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-zinc-700 dark:text-zinc-300">
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
        </section>
      </main>
    </div>
  );
}
