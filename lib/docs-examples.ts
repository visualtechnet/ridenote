import type { NoteErrorCode } from "./validation";
import { LIMITS } from "./config";

/**
 * Example notes shown in the docs. The validation layer is deterministic, so a test runs every
 * example through the real validator: the docs cannot drift from what the app actually does.
 */

export type ValidExample = { title: string; note: string; why: string };
export type InvalidExample = {
  title: string;
  note: string;
  code: NoteErrorCode;
  why: string;
  /** Shown instead of `note` when the raw text is invisible or enormous. */
  display?: string;
};

export const VALID_EXAMPLES: ValidExample[] = [
  {
    title: "Complete note",
    note: "Pick up Mrs. Lee at 12 Oak St at 9:30am, taking her to County Hospital. She uses a wheelchair.",
    why: "All four required fields plus mobility. Nothing ends up in Missing.",
  },
  {
    title: "Missing dropoff",
    note: "Pick up Mr. Davis at 44 Pine Ave at 2pm, ambulatory.",
    why: "Valid input. The parse succeeds and Dropoff comes back as Not stated and listed under Missing.",
  },
  {
    title: "Name only",
    note: "Rides for Priya Shah tomorrow.",
    why: "Long enough and clean, so it parses. Most fields come back empty and are listed as Missing.",
  },
  {
    title: "Address without a state",
    note: "Pick up Omar at 12 Oak St, Springfield at 8:15 to Mercy Clinic.",
    why: "Locations are free text, not city/state/zip columns. A missing state is kept as written and does not fail the parse.",
  },
  {
    title: "Address with unit and punctuation",
    note: "Collect Ana Ruiz from 500 N. Main St., Apt #3B (rear entrance) at 07:45, to St. Mary's Hospital, 2nd floor.",
    why: "Periods, commas, #, parentheses and apostrophes are all ordinary characters.",
  },
  {
    title: "Quotes and backslashes",
    note: 'Pick up Mrs. "Peg" O\'Brien at 5\\6 Elm St at 10:00, to the clinic.',
    why: "Quotes and backslashes are special inside JSON, but the app encodes the request for you, so they are safe.",
  },
  {
    title: "Family emoji (joined sequence)",
    note: "Pick up the Garcia family 👨‍👩‍👧 at 5 Birch Ln at 3pm, to the zoo.",
    why: "The invisible joiner inside emoji sequences is allowed. Other invisible characters are not.",
  },
  {
    title: "Accents and emoji",
    note: "Recoger a José Müller en Calle Ñandú 7 a las 6pm, destino Hospital Sant Joan 🏥, silla de ruedas.",
    why: "Any language and emoji are fine. Text is normalised (NFC) so composed and decomposed accents match.",
  },
  {
    title: "Multi-line paste",
    note: "Passenger: Lee\nFrom: 12 Oak St\nTo: County Hospital\nTime: 9:30\nMobility: stretcher",
    why: "Line breaks and tabs are allowed, so a note pasted from a form or email works.",
  },
  {
    title: "Less-than sign in plain text",
    note: "Mr. Chen at 9 Lake Rd, pickup in < 10 minutes, to the airport.",
    why: "A < followed by a space and a digit is not markup. Only < followed by a letter, / ! or ? is blocked (an email address in angle brackets is the one exception).",
  },
  {
    title: "Email address in angle brackets",
    note: "From: Dana <dana@clinic.example.org>. Pick up Mrs. Lee at 12 Oak St at 9:30am, to County Hospital.",
    why: "Name <address> as pasted from an email is allowed. Any other < followed by a letter is still treated as a tag.",
  },
  {
    title: "Padded with spaces",
    note: "   Pick up Sam at 3 Elm St at 4pm, to the library.   ",
    why: "Leading and trailing whitespace is trimmed before the checks and before sending.",
  },
  {
    title: "Exactly the minimum length",
    note: "Sam 4",
    why: `${LIMITS.noteMin} characters is the shortest note accepted (it will mostly come back as Missing).`,
  },
];

export const INVALID_EXAMPLES: InvalidExample[] = [
  {
    title: "Nothing typed",
    note: "",
    code: "required",
    display: "(empty)",
    why: "An empty note, or one with only spaces, counts as missing.",
  },
  {
    title: "Only spaces",
    note: "      ",
    code: "required",
    display: "(spaces only)",
    why: "Whitespace is trimmed first, leaving nothing.",
  },
  {
    title: "Too short",
    note: "hi",
    code: "too_short",
    why: `Shorter than ${LIMITS.noteMin} characters after trimming.`,
  },
  {
    title: "Too long",
    note: "a".repeat(LIMITS.noteMax + 1),
    code: "too_long",
    display: `(${LIMITS.noteMax + 1} characters)`,
    why: `More than ${LIMITS.noteMax.toLocaleString("en-US")} characters after trimming.`,
  },
  {
    title: "Null byte",
    note: "Pick up Lee at 12 Oak St\u0000 at 9am",
    code: "hidden_characters",
    display: "Pick up Lee at 12 Oak St<NUL> at 9am",
    why: "Control characters are invisible and often come from broken copy and paste.",
  },
  {
    title: "Right-to-left override",
    note: "Pick up Lee at 12 Oak St ‮ at 9am",
    code: "hidden_characters",
    display: "Pick up Lee at 12 Oak St <U+202E> at 9am",
    why: "Bidirectional overrides make text display differently from how it is stored.",
  },
  {
    title: "Zero-width space",
    note: "Pick up Lee at 12 Oak St\u200B at 9am",
    code: "hidden_characters",
    display: "Pick up Lee at 12 Oak St<U+200B> at 9am",
    why: "Zero-width and other invisible characters can hide text from the person reading the note.",
  },
  {
    title: "Script tag",
    note: "Pick up Lee <script>alert(1)</script> at 12 Oak St",
    code: "markup",
    why: "HTML and script tags are rejected, not cleaned, so nothing is silently changed.",
  },
  {
    title: "Any HTML tag",
    note: "Pick up <b>Lee</b> at 12 Oak St at 9am",
    code: "markup",
    why: "Even harmless tags such as <b> are blocked. < followed by a letter starts a tag.",
  },
  {
    title: "Tag with a space after <",
    note: "Pick up Lee at 12 Oak St < script >alert(1)",
    code: "markup",
    why: "Whitespace between < and the tag name does not get around the check.",
  },
  {
    title: "HTML comment",
    note: "Pick up Lee at 12 Oak St <!-- hidden --> at 9am",
    code: "markup",
    why: "< followed by ! (comments, doctype) is blocked.",
  },
  {
    title: "javascript: link",
    note: "Drop off at javascript:alert(1) for Lee at 9am",
    code: "markup",
    why: "Script URL schemes are blocked.",
  },
  {
    title: "Split-up javascript: link",
    note: "Drop off at java script:alert(1) for Lee at 9am",
    code: "markup",
    why: "Whitespace inside the scheme is caught too.",
  },
];

/** Raw API bodies, for people calling POST /api/parse directly (for example with curl). */
export type ApiExample = { title: string; body: string; status: number; result: string };
export const API_EXAMPLES: ApiExample[] = [
  {
    title: "Valid request",
    body: '{"note":"Pick up Mrs. Lee at 12 Oak St at 9:30am to County Hospital, wheelchair"}',
    status: 200,
    result: "Returns { trip: {...} }",
  },
  {
    title: "Not JSON at all",
    body: "Pick up Mrs. Lee",
    status: 400,
    result: "invalid JSON message",
  },
  {
    title: "Unescaped line break inside the JSON string",
    body: '{"note":"line one\nline two"}   // a real newline, not \\n',
    status: 400,
    result: "invalid JSON message. JSON strings must write a line break as \\n",
  },
  {
    title: "Trailing comma / single quotes",
    body: "{'note': 'hello there',}",
    status: 400,
    result: "invalid JSON message",
  },
  {
    title: "Wrong field name",
    body: '{"text":"Pick up Mrs. Lee at 12 Oak St"}',
    status: 400,
    result: 'code "required": the body must contain "note"',
  },
  {
    title: "Note is not a string",
    body: '{"note":12345}',
    status: 400,
    result: 'code "required"',
  },
  {
    title: "Body is an array or a bare string",
    body: '["Pick up Mrs. Lee"]',
    status: 400,
    result: 'code "required"',
  },
  {
    title: "Escaped control character",
    body: '{"note":"Pick up Lee\\u0000 at 12 Oak St"}',
    status: 400,
    result: 'code "hidden_characters": valid JSON, but the decoded text is rejected',
  },
  {
    title: "Not declared as JSON (Content-Type: text/plain)",
    body: '{"note":"Pick up Mrs. Lee at 12 Oak St"}',
    status: 415,
    result: "unsupported media type. Send Content-Type: application/json",
  },
  {
    title: "Body over the size limit",
    body: `{"note":"…more than ${LIMITS.bodyMaxBytes.toLocaleString("en-US")} bytes…"}`,
    status: 413,
    result: "request too large, rejected before it is parsed",
  },
];
