import { z } from "zod";
import { LIMITS } from "./config";
import { MESSAGES } from "./messages";

export type NoteErrorCode = "required" | "too_short" | "too_long" | "hidden_characters" | "markup";

export type NoteResult =
  { ok: true; note: string } | { ok: false; code: NoteErrorCode; message: string };

// Control characters (except tab/newline/carriage return), bidirectional overrides ("Trojan Source"
// tricks) and invisible format characters that let text hide from a reader: zero-width space,
// directional marks, line/paragraph separators, word joiner and the byte order mark. U+200C and
// U+200D are allowed because emoji sequences and several scripts need them.
const HIDDEN_CHARACTERS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u200E\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/;

// An HTML tag, comment, doctype or processing instruction: "<" followed by a letter, "/", "!" or "?".
const HTML_MARKUP = /<\s*[a-z/!?]/i;

// Script-capable URL schemes, with optional whitespace tricks like "java script:".
const SCRIPT_SCHEME = /\b(?:java\s*script|vbscript)\s*:/i;

// Like trim(), but leaves U+FEFF, U+2028 and U+2029 in place. trim() treats them as whitespace and
// would silently delete them from the ends, hiding them from the hidden-character check.
export const trimOrdinary = (s: string) =>
  s.replace(/^[^\S\uFEFF\u2028\u2029]+|[^\S\uFEFF\u2028\u2029]+$/g, "");

// `abort: true` stops at the first broken rule, so people see one clear message at a time.
const rule = (
  code: NoteErrorCode,
  ok: (s: string) => boolean,
  error: string | ((s: string) => string),
) => ({
  check: ok,
  options: {
    abort: true,
    params: { code },
    error:
      typeof error === "string"
        ? error
        : (issue: { input?: unknown }) => error(String(issue.input)),
  },
});

const rules = [
  rule("required", (s) => s.length > 0, MESSAGES.noteRequired),
  rule("too_short", (s) => s.length >= LIMITS.noteMin, MESSAGES.noteTooShort),
  rule(
    "too_long",
    (s) => s.length <= LIMITS.noteMax,
    (s) => MESSAGES.noteTooLong(s.length),
  ),
  rule("hidden_characters", (s) => !HIDDEN_CHARACTERS.test(s), MESSAGES.noteHiddenCharacters),
  rule("markup", (s) => !HTML_MARKUP.test(s) && !SCRIPT_SCHEME.test(s), MESSAGES.noteMarkup),
];

/** The one definition of "a valid note", shared by the form and the API. */
export const NoteSchema = rules.reduce<z.ZodType<string>>(
  (schema, { check, options }) => schema.refine(check, options),
  z
    .string({ error: MESSAGES.noteRequired })
    .transform((s) => trimOrdinary(s).normalize("NFC"))
    .pipe(z.string()),
);

/** The JSON body the API accepts. */
export const ParseRequestSchema = z.object({ note: NoteSchema }, { error: MESSAGES.noteRequired });

type Parsed<T> = { success: true; data: T } | { success: false; error: z.ZodError };

function toResult<T>(parsed: Parsed<T>, pickNote: (data: T) => string): NoteResult {
  if (parsed.success) return { ok: true, note: pickNote(parsed.data) };
  const issue = parsed.error.issues[0];
  const code = (issue as { params?: { code?: NoteErrorCode } }).params?.code ?? "required";
  return { ok: false, code, message: issue.message };
}

/** Validates text typed into the form. Anything that isn't a string is treated as missing. Never throws. */
export function validateNote(input: unknown): NoteResult {
  return toResult(NoteSchema.safeParse(input), (note) => note);
}

/** Validates the API's JSON body. Must be exactly `{ note: string }`; extra fields are dropped. */
export function validateRequestBody(body: unknown): NoteResult {
  return toResult(ParseRequestSchema.safeParse(body), (data) => data.note);
}
