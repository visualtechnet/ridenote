import type { Metadata } from "next";
import Link from "next/link";
import { TryButton } from "@/components/TryButton";
import { HTTP, LIMITS, MOBILITY, OUTPUT_LIMITS, RATE_LIMIT } from "@/lib/config";
import { API_EXAMPLES, INVALID_EXAMPLES, VALID_EXAMPLES } from "@/lib/docs-examples";
import { MESSAGES } from "@/lib/messages";
import { Routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Docs",
  description: "Setup, accepted and rejected inputs, and every error explained.",
};

const h2 = "mt-10 scroll-mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50";
const p = "mt-2 text-zinc-700 dark:text-zinc-300";
const code = "rounded bg-zinc-200 px-1 py-0.5 font-mono text-sm dark:bg-zinc-800";
const pre =
  "mt-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 font-mono text-sm text-zinc-50 whitespace-pre-wrap break-words";
const th = "border-b border-zinc-300 px-3 py-2 text-left font-medium dark:border-zinc-700";
const td = "border-b border-zinc-200 px-3 py-2 align-top dark:border-zinc-800";

const errors = [
  [
    HTTP.badRequest,
    "Bad request",
    "Your note or request was rejected before reaching the AI. Fix the input and resend.",
    `Validation messages below, ${MESSAGES.invalidJson}`,
  ],
  [
    HTTP.payloadTooLarge,
    "Payload too large",
    `The request body is over ${LIMITS.bodyMaxBytes.toLocaleString("en-US")} bytes. Shorten the note.`,
    MESSAGES.bodyTooLarge,
  ],
  [
    HTTP.unsupportedMediaType,
    "Unsupported media type",
    "The request was not sent as JSON. Add the header Content-Type: application/json.",
    MESSAGES.unsupportedMediaType,
  ],
  [
    HTTP.unprocessable,
    "Unprocessable",
    "The request was valid, but the AI declined to process that note. Rephrase it.",
    MESSAGES.modelDeclined,
  ],
  [
    HTTP.tooManyRequests,
    "Too many requests",
    `More than ${RATE_LIMIT.maxRequests} parses in ${RATE_LIMIT.windowMs / 1000} seconds from one client. Wait for the Retry-After seconds.`,
    MESSAGES.tooManyRequests,
  ],
  [
    HTTP.badGateway,
    "Bad gateway",
    "The AI service failed, timed out, or returned an answer that did not match the trip format. Nothing is wrong with your note. Try again.",
    MESSAGES.parseFailed,
  ],
  [
    HTTP.unavailable,
    "Service unavailable",
    'The server is protecting itself from overload (too many parses at once, or the shared per-minute budget is used up), or the demo\'s fixed monthly AI budget is spent. Nothing is wrong with your note. For overload, wait for the Retry-After seconds and try again. For "used up its AI budget", try again when the monthly limit renews, or run it with your own key.',
    MESSAGES.busy,
  ],
  [
    404,
    "Not found",
    "That page does not exist. Check the address, or go back to the parser.",
    MESSAGES.notFound,
  ],
  [
    405,
    "Method not allowed",
    "The API only accepts POST. Opening /api/parse in a browser sends GET, which is refused.",
    "(empty response)",
  ],
  [
    500,
    "Server error",
    "An unexpected crash. The app shows an error page with a Try again button.",
    MESSAGES.unexpected,
  ],
] as const;

const validationCodes = [
  [
    "required",
    "Empty, whitespace only, not a string, or the body has no note field.",
    MESSAGES.noteRequired,
  ],
  ["too_short", `Fewer than ${LIMITS.noteMin} characters after trimming.`, MESSAGES.noteTooShort],
  [
    "too_long",
    `More than ${LIMITS.noteMax.toLocaleString("en-US")} characters after trimming.`,
    "Your note is N characters. Please shorten it…",
  ],
  [
    "hidden_characters",
    "Control characters, right-to-left overrides, or invisible characters such as a zero-width space.",
    MESSAGES.noteHiddenCharacters,
  ],
  [
    "markup",
    "An HTML tag, comment, doctype, or a javascript:/vbscript: link.",
    MESSAGES.noteMarkup,
  ],
] as const;

export default function DocsPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Documentation
        </h1>
        <p className={p}>
          This section has three parts, in the menu on the left: <strong>Setup</strong> (this page),{" "}
          <Link href={Routes.page("docsEval")} className="underline underline-offset-4">
            Eval
          </Link>{" "}
          (how the AI&rsquo;s accuracy is measured) and{" "}
          <Link href={Routes.page("docsFaq")} className="underline underline-offset-4">
            FAQ
          </Link>{" "}
          (common questions, and the bugs found along the way).
        </p>
        <p className={p}>
          How to set up RideNote, what to type into it, and what every error means. This page
          contains no keys or secrets, and every example below is checked against the real validator
          by an automated test.
        </p>
        <nav aria-label="On this page" className="mt-4">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-900 underline underline-offset-4 dark:text-zinc-50">
            {[
              ["need", "What you need"],
              ["setup", "Setup"],
              ["api-key", "Getting an API key"],
              ["demo", "Sharing a demo"],
              ["first-parse", "First parse"],
              ["writing-notes", "Writing a good note"],
              ["valid", "Accepted inputs"],
              ["invalid", "Rejected inputs"],
              ["json", "Breaking JSON"],
              ["output", "Output fields"],
              ["errors", "Errors"],
              ["privacy", "Privacy"],
            ].map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="need">
          <h2 id="need" className={h2}>
            What you need to try it
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-6 text-zinc-700 dark:text-zinc-300">
            <li>
              <strong>To run it on your own computer, you need your own Anthropic API key.</strong>{" "}
              This project does not include one, and the AI cannot run without it. You create it in
              your own Anthropic account (steps below, about five minutes) and pay only for what you
              use, a fraction of a cent per parse. API keys are not provided or shared.
            </li>
            <li>
              <strong>To try it with no setup,</strong> use the public demo if you were given a
              link. It runs on a small, fixed budget of about $5 a month for everyone together, and
              that limit is not raised. When it is used up, the page says &ldquo;This demo has used
              up its AI budget&rdquo; and it stays unavailable until the monthly limit renews.
              Nothing is wrong with your note. To keep going, run it yourself with your own key.
            </li>
            <li>
              <strong>Questions or feedback?</strong> See the{" "}
              <Link href={Routes.page("contact")} className="underline underline-offset-4">
                Contact
              </Link>{" "}
              page.
            </li>
          </ul>
        </section>

        <section aria-labelledby="setup">
          <h2 id="setup" className={h2}>
            Setup
          </h2>
          <ol className="mt-2 list-decimal space-y-2 pl-6 text-zinc-700 dark:text-zinc-300">
            <li>
              Install Node.js 20 or newer, then run <code className={code}>npm install</code>.
            </li>
            <li>
              Create your own Anthropic API key (see{" "}
              <a href="#api-key" className="underline underline-offset-4">
                Getting an API key
              </a>
              ) and copy it. The Console shows it only once.
            </li>
            <li>
              Copy <code className={code}>.env.example</code> to{" "}
              <code className={code}>.env.local</code>, open it, and paste your key after{" "}
              <code className={code}>ANTHROPIC_API_KEY=</code> (no quotes, no spaces). Save the
              file. It is git-ignored, and the key is only read on the server and never sent to the
              browser.
            </li>
            <li>
              Optional: set <code className={code}>MODEL</code> to use a different Claude model.
              Without it the app uses the default in <code className={code}>lib/config.ts</code>.
            </li>
            <li>
              Run <code className={code}>npm run dev</code> and open{" "}
              <code className={code}>http://localhost:3000</code>. Stop it with Ctrl + C.
            </li>
            <li>
              Check everything with <code className={code}>npm run check</code> (types, lint,
              format, unit tests) and <code className={code}>npm run test:e2e</code> (real browser).
            </li>
          </ol>
          <p className={p}>
            <strong>On a Mac and prefer not to keep the key in a file?</strong> Skip the{" "}
            <code className={code}>.env.local</code> step and run{" "}
            <code className={code}>npm run dev:key</code> instead of{" "}
            <code className={code}>npm run dev</code>. The first time it asks for your key and saves
            it in your Mac&rsquo;s Keychain, so you are never asked again. Manage the saved key with{" "}
            <code className={code}>npm run key:status</code>,{" "}
            <code className={code}>npm run key:set</code> and{" "}
            <code className={code}>npm run key:remove</code>.
          </p>
        </section>

        <section aria-labelledby="api-key">
          <h2 id="api-key" className={h2}>
            Getting an API key
          </h2>
          <p className={p}>
            RideNote calls the Claude API, so it needs a key from your own Anthropic account. Each
            person who runs it locally uses their own key; the project contains none.
          </p>
          <ol className="mt-2 list-decimal space-y-2 pl-6 text-zinc-700 dark:text-zinc-300">
            <li>
              Sign in or create an account at{" "}
              <a
                href="https://console.anthropic.com/"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                console.anthropic.com
              </a>
              .
            </li>
            <li>
              Add a small amount of credit under billing, for example <strong>$5</strong>, and leave
              auto-reload <strong>off</strong>. When the balance is used up, calls stop instead of
              charging more. One parse costs a fraction of a cent.
            </li>
            <li>
              Open <strong>API keys</strong> and create a key named after the project (for example{" "}
              <code className={code}>ridenote-local</code>). If you can, create it in its own
              workspace with a low monthly spend limit.
            </li>
            <li>Copy the key straight away. The Console shows it only once.</li>
            <li>
              Run <code className={code}>cp .env.example .env.local</code>, open{" "}
              <code className={code}>.env.local</code>, and paste the key after{" "}
              <code className={code}>ANTHROPIC_API_KEY=</code>. Then run{" "}
              <code className={code}>npm run dev</code>. (On a Mac you can run{" "}
              <code className={code}>npm run dev:key</code> instead and paste the key when it asks.)
            </li>
            <li>
              Open <code className={code}>http://localhost:3000</code>, click{" "}
              <strong>Use an example</strong>, then <strong>Parse</strong>.
            </li>
          </ol>
          <p className={p}>Menu names in the Console change from time to time.</p>
          <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Keeping the key safe
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-zinc-700 dark:text-zinc-300">
            <li>
              Never commit it or paste it into an issue, chat or screenshot. The{" "}
              <code className={code}>.env.local</code> file is git-ignored and the pre-commit hook
              refuses env files.
            </li>
            <li>
              Never name it with a <code className={code}>NEXT_PUBLIC_</code> prefix: Next.js would
              send it to every visitor&rsquo;s browser.
            </li>
            <li>If it leaks, delete it in the Console and create a new one.</li>
            <li>Use a different key for each person and each environment.</li>
          </ul>
        </section>

        <section aria-labelledby="demo">
          <h2 id="demo" className={h2}>
            Sharing or deploying a demo
          </h2>
          <p className={p}>
            Someone who only wants to see RideNote should not have to create a key.
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6 text-zinc-700 dark:text-zinc-300">
            <li>
              <strong>Best: host it.</strong> Deploy the app (for example on Vercel) with the key
              stored as a <em>server-only</em> environment variable, using a key made for the demo
              with a low spend limit ($2 to $5 is plenty). Visitors open a link and click Parse and
              never see the key. The per-client limit ({RATE_LIMIT.maxRequests} requests a minute),
              the shared budget, the {LIMITS.noteMax.toLocaleString("en-US")} character note limit
              and the answer-size cap keep what anyone can do through it small.
            </li>
            <li>
              <strong>Don&rsquo;t hand out keys.</strong> A key can be used directly against the
              API, up to its cap, not only through this app. Anyone who wants to go beyond the demo
              creates their own key in their own account and runs the project themselves.
            </li>
            <li>
              <strong>On Vercel:</strong> import the repository and add{" "}
              <code className={code}>ANTHROPIC_API_KEY</code> under Environment Variables for{" "}
              <strong>Production</strong> only, marked <strong>Sensitive</strong>. Deploy, then
              click Use an example and Parse. After changing the variable later, redeploy. The
              README has the full steps.
            </li>
            <li>
              <strong>Keep the demo&rsquo;s limit fixed.</strong> It is the most the demo can ever
              cost. When it is used up, the parser says &ldquo;This demo has used up its AI
              budget&rdquo; (the API answers {HTTP.unavailable} with code{" "}
              <code className={code}>out_of_credit</code>) and the server log says{" "}
              <code className={code}>parse failed: out of credit</code>. The demo stays unavailable
              until the monthly limit renews, and visitors are pointed to running it with their own
              key.
            </li>
          </ul>
        </section>

        <section aria-labelledby="first-parse">
          <h2 id="first-parse" className={h2}>
            Your first successful parse
          </h2>
          <ol className="mt-2 list-decimal space-y-2 pl-6 text-zinc-700 dark:text-zinc-300">
            <li>Open the parser (the home page).</li>
            <li>
              Click <strong>Use an example</strong>, or paste a note of your own.
            </li>
            <li>
              Press <strong>Parse</strong> or Ctrl/⌘ + Enter.
            </li>
            <li>
              A card appears with passenger, pickup, dropoff, time and mobility. Anything the note
              did not say is shown as <em>Not stated</em> and listed under <em>Missing</em>.
            </li>
            <li>Always verify the card against the note before dispatching. It is AI-extracted.</li>
          </ol>
        </section>

        <section aria-labelledby="writing-notes">
          <h2 id="writing-notes" className={h2}>
            Writing a good note
          </h2>
          <p className={p}>
            Write the way a dispatcher naturally would. The more of these you include, the fewer
            fields come back Missing:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-zinc-700 dark:text-zinc-300">
            <li>
              <strong>Who:</strong> passenger name.
            </li>
            <li>
              <strong>Where from and to:</strong> street addresses or place names. A state or zip is
              optional.
            </li>
            <li>
              <strong>When:</strong> a time such as 9:30am, 14:15 or 0930. The card shows it as{" "}
              <strong>9:30 AM</strong>; the API returns it as 24-hour HH:MM (09:30). The time is
              kept as the note writes it: there is no time zone conversion.
            </li>
            <li>
              <strong>Mobility:</strong> every aid the passenger uses, for example a wheelchair, a
              cane or a walker. All of them are listed, as a list. The AI sorts plain words into
              these categories: {MOBILITY.join(", ")} (a rollator becomes a walker, a gurney a
              stretcher). If the note says nothing, the list is empty (
              <code className={code}>[]</code>) and the card says &ldquo;Not stated&rdquo;.
            </li>
          </ul>
          <p className={p}>
            The parser never guesses. If something is not in the note it comes back empty rather
            than invented. Dates like &ldquo;tomorrow&rdquo; are not converted because only the time
            is stored, and times are never converted between time zones: &ldquo;3pm EST&rdquo; is{" "}
            <code className={code}>15:00</code>, with the zone repeated in the notes.
          </p>
        </section>

        <section aria-labelledby="valid">
          <h2 id="valid" className={h2}>
            Accepted inputs (positive cases)
          </h2>
          <p className={p}>
            Two layers decide success. First the <strong>validator</strong> (fixed rules, below)
            accepts or rejects the text. Then the <strong>AI</strong> extracts fields from accepted
            text. A note that passes the validator always parses; it just may have empty fields.
          </p>
          <ul className="mt-4 space-y-4">
            {VALID_EXAMPLES.map((ex) => (
              <li
                key={ex.title}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{ex.title}</h3>
                <pre className={pre}>{ex.note}</pre>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{ex.why}</p>
                <div className="mt-2">
                  <TryButton note={ex.note} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="invalid">
          <h2 id="invalid" className={h2}>
            Rejected inputs (negative cases)
          </h2>
          <p className={p}>
            Rules run in this order and stop at the first failure, so you see one clear message at a
            time: required, too short, too long, hidden characters, markup. Nothing is silently
            cleaned; a rejected note is refused with an explanation.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-800 dark:text-zinc-200">
              <caption className="sr-only">Validation codes</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Code
                  </th>
                  <th scope="col" className={th}>
                    Triggered by
                  </th>
                  <th scope="col" className={th}>
                    Message shown
                  </th>
                </tr>
              </thead>
              <tbody>
                {validationCodes.map(([c, when, msg]) => (
                  <tr key={c}>
                    <th scope="row" className={`${td} font-mono font-normal`}>
                      {c}
                    </th>
                    <td className={td}>{when}</td>
                    <td className={td}>{msg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 space-y-4">
            {INVALID_EXAMPLES.map((ex) => (
              <li
                key={ex.title}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                  {ex.title} <span className={code}>{ex.code}</span>
                </h3>
                <pre className={pre}>{ex.display ?? ex.note}</pre>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{ex.why}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="json">
          <h2 id="json" className={h2}>
            Ways to break the JSON
          </h2>
          <p className={p}>
            The page builds the JSON for you, so typing quotes, backslashes, emoji or new lines into
            the box is safe. Problems only appear when you call{" "}
            <code className={code}>POST {Routes.api("parse")}</code> yourself (for example with
            curl). The body must be exactly <code className={code}>{`{"note": "..."}`}</code>.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-800 dark:text-zinc-200">
              <caption className="sr-only">Raw API requests and their results</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Case
                  </th>
                  <th scope="col" className={th}>
                    Body
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                  <th scope="col" className={th}>
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {API_EXAMPLES.map((ex) => (
                  <tr key={ex.title}>
                    <th scope="row" className={`${td} font-normal`}>
                      {ex.title}
                    </th>
                    <td className={`${td} font-mono break-all whitespace-pre-wrap`}>{ex.body}</td>
                    <td className={td}>{ex.status}</td>
                    <td className={td}>{ex.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={p}>
            The reverse direction is guarded too. The AI is forced to answer in a fixed shape, and
            the server re-checks that answer. Two harmless slips are repaired instead of failing a
            good note: a notes line that runs too long is shortened, and a repeated mobility aid is
            removed. If it breaks the shape in any other way (a time that is not HH:MM, an aid
            outside the list, &ldquo;walks unaided&rdquo; mixed with an aid, a name over the length
            limit, extra or missing fields) you get a 502, never malformed data.
          </p>
        </section>

        <section aria-labelledby="output">
          <h2 id="output" className={h2}>
            Output fields
          </h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-800 dark:text-zinc-200">
              <caption className="sr-only">Trip fields</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Field
                  </th>
                  <th scope="col" className={th}>
                    Type
                  </th>
                  <th scope="col" className={th}>
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    passenger_name
                  </th>
                  <td className={td}>text or null</td>
                  <td className={td}>Up to {OUTPUT_LIMITS.name} characters.</td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    pickup_location
                  </th>
                  <td className={td}>text or null</td>
                  <td className={td}>
                    Free text, up to {OUTPUT_LIMITS.location} characters. Not split into city or
                    state.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    dropoff_location
                  </th>
                  <td className={td}>text or null</td>
                  <td className={td}>Same as pickup.</td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    pickup_time
                  </th>
                  <td className={td}>&ldquo;HH:MM&rdquo; or null</td>
                  <td className={td}>
                    24-hour, 00:00 to 23:59, as written in the note: no AM/PM, no time zone, no
                    conversion.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    mobility
                  </th>
                  <td className={td}>array of {MOBILITY.join(" | ")}</td>
                  <td className={td}>
                    Every aid the note names, no repeats. <code className={code}>[]</code> when not
                    stated. <code className={code}>ambulatory</code> (walks unaided) stands alone.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    missing_fields
                  </th>
                  <td className={td}>list of names</td>
                  <td className={td}>
                    Computed by the server from the nulls above, so it cannot disagree with the
                    data.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={`${td} font-mono font-normal`}>
                    notes
                  </th>
                  <td className={td}>text</td>
                  <td className={td}>
                    One short sentence about anything ambiguous, up to {OUTPUT_LIMITS.notes}{" "}
                    characters.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="errors">
          <h2 id="errors" className={h2}>
            What the errors mean
          </h2>
          <p className={p}>
            HTTP status codes are three-digit numbers saying how a request went. 2xx means success,
            4xx means the request was wrong (you can fix it), 5xx means our side or the AI failed.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-800 dark:text-zinc-200">
              <caption className="sr-only">HTTP status codes</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Status
                  </th>
                  <th scope="col" className={th}>
                    Meaning
                  </th>
                  <th scope="col" className={th}>
                    What to do
                  </th>
                  <th scope="col" className={th}>
                    Message
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className={`${td} font-normal`}>
                    {HTTP.ok}
                  </th>
                  <td className={td}>OK</td>
                  <td className={td}>
                    Success. The response has a <code className={code}>trip</code>.
                  </td>
                  <td className={td}>(card shown)</td>
                </tr>
                {errors.map(([status, name, what, msg]) => (
                  <tr key={status}>
                    <th scope="row" className={`${td} font-normal`}>
                      {status}
                    </th>
                    <td className={td}>{name}</td>
                    <td className={td}>{what}</td>
                    <td className={td}>{msg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={p}>
            <strong>Network error:</strong> &ldquo;{MESSAGES.network}&rdquo; means the browser never
            got an answer (offline, server down). It is not an HTTP status.
          </p>
        </section>

        <section aria-labelledby="privacy">
          <h2 id="privacy" className={h2}>
            Privacy and security
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-zinc-700 dark:text-zinc-300">
            <li>
              The API key lives only in server environment variables. It is not in the code, the
              browser or these docs.
            </li>
            <li>
              Notes may contain personal details. They are sent to the AI service to be parsed and
              are not stored by this app; server logs record only an error type.
            </li>
            <li>Use fictional names and addresses in examples, tests and bug reports.</li>
            <li>
              Requests are rate limited, size limited and capped across all users, to protect the
              service and its cost. Identical notes sent at the same moment share one AI call.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
