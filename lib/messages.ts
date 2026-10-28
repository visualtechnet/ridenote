import { LIMITS } from "./config";
import type { Usage } from "./usage";

/** User-facing validation and error text. Written for dispatchers, not developers. */
export const MESSAGES = {
  noteRequired: "Please enter a dispatcher note before parsing.",
  noteTooShort: `That note is too short to parse. Please add a few more details (at least ${LIMITS.noteMin} characters).`,
  noteTooLong: (length: number) =>
    `Your note is ${length.toLocaleString("en-US")} characters. Please shorten it to ${LIMITS.noteMax.toLocaleString("en-US")} or fewer.`,
  noteHiddenCharacters:
    "Your note contains hidden or unsupported characters. Please retype or paste it as plain text.",
  noteMarkup:
    "Notes can't contain HTML, code or script links (for example <script>). Please remove them and try again.",
  invalidJson: "We couldn't read that request. Please refresh the page and try again.",
  bodyTooLarge: "That request is too large. Please shorten your note and try again.",
  unsupportedMediaType: "Requests must be sent as JSON (Content-Type: application/json).",
  busy: "We're handling a lot of requests right now. Please try again in a moment.",
  outOfCredit:
    "This demo has used up its AI budget. Please try again later, or run RideNote yourself with your own API key (see Docs, Setup).",
  tooManyRequests: "You're going a bit fast. Please wait a moment and try again.",
  unauthorized: "Unauthorized.",
  purgeFailed: "The clean-up could not be completed.",
  parseFailed: "We couldn't parse that note. Please try again.",
  modelDeclined: "The assistant couldn't process that note. Please rephrase it and try again.",
  tooManyRequestsIn: (seconds: number) =>
    `You're going a bit fast. Please wait ${seconds} second${seconds === 1 ? "" : "s"} and try again.`,
  timeout: "That is taking too long. Please try again.",
  network: "We couldn't reach the server. Check your connection and try again.",
  notFound: "We couldn't find that page.",
  unexpected: "Something went wrong on our side. Please try again.",
} as const;

/** Visible labels and text. */
export const COPY = {
  appName: "RideNote",
  tagline: "Dispatcher notes, turned into trips.",
  appDescription: "Turn a dispatcher note into a structured trip record.",
  historyNotice:
    "Results are saved and shown publicly on the History page for 7 days on the live site. Please use made-up names and addresses.",
  intro:
    "RideNote turns a dispatcher's free-text message into a structured ride record: who is travelling, where from and to, when, and what mobility help they need. Paste the note, press Parse, and get a clean card instead of retyping it.",
  howItWorksLabel: "How it works",
  howItWorksSteps: [
    "Paste the note exactly as you received it.",
    "Press Parse. An AI reads it and pulls out the details.",
    "Check the card. Anything the note did not say is marked Missing, never guessed.",
  ],
  noteLabel: "Dispatcher note",
  notePlaceholder:
    "Pick up Mrs. Lee at 12 Oak St tomorrow 9:30am, going to County Hospital, wheelchair.",
  parse: "Parse",
  parsing: "Parsing…",
  useExample: "Use an example",
  clear: "Clear",
  exampleNote:
    "Pick up Mrs. Lee at 12 Oak St at 9:30am, taking her to County Hospital. She uses a wheelchair.",
  shortcutHint: "Ctrl/⌘ + Enter to parse",
  resultLabel: "Parsed trip",
  loadingLabel: "Parsing note",
  unknownPassenger: "Unknown passenger",
  notStated: "Not stated",
  fieldPickup: "Pickup",
  fieldDropoff: "Dropoff",
  fieldPickupTime: "Pickup time",
  fieldMobility: "Mobility",
  mobilityListLabel: "Mobility",
  mobilityLabels: {
    ambulatory: "Walks unaided",
    wheelchair: "Wheelchair",
    stretcher: "Stretcher",
    walker: "Walker",
    cane: "Cane",
    crutches: "Crutches",
    scooter: "Scooter",
    other: "Other aid",
  },
  missingHeading: "Missing",
  confirmMobility: "Mobility not stated. Confirm before dispatching.",
  missingListLabel: "Missing fields",
  staleResult: "The note has changed since this was parsed. Parse again to update it.",
  usageLabel: "Usage",
  ratingEfficient: "Efficient",
  ratingProblematic: "Problematic",
  ratingSummary: (rated: number, tokens: number, latencyMs: number) =>
    `Rated against the median of ${rated} calls (${Math.round(tokens)} tokens, ${Math.round(latencyMs)} ms). Ratings are relative: a long note uses more tokens.`,
  usageValue: (u: Usage) => `${u.inputTokens} in · ${u.outputTokens} out · ${u.latencyMs} ms`,
  verifyReminder: "AI-extracted from the note. Verify before dispatching.",
  skipToContent: "Skip to main content",
  tryAgain: "Try again",
  backHome: "Back to the parser",
  menu: "Menu",
  navLabel: "Main",
  onThisPage: "On this page",
  navParser: "Parser",
  navRequirements: "Requirements",
  navDocs: "Docs",
  navTests: "Tests",
  navHistory: "History",
  navContact: "Contact",
  navDocsSections: "Documentation sections",
  navDocsSetup: "Setup",
  navDocsEval: "Eval",
  navDocsFaq: "FAQ",
  navDocsAgents: "Agents",
  historyTitle: "History",
  historyDescription: "The most recent notes parsed on this site.",
  historyPrivacy:
    "Entries are public, kept for 7 days, and have phone numbers, emails and other contact details removed. The note itself is never saved.",
  historyLoading: "Loading history…",
  historyDisabled: "History is turned off in this environment. It is saved only on the live site.",
  historyError: "History could not be loaded right now. Try again in a minute.",
  historyEmpty: "Nothing has been parsed in the last 7 days.",
  historyListLabel: "Recent parsed trips",
  historySaved: "Saved",
  tryInParser: "Try in the parser",
  errorTitle: "Something went wrong",
  notFoundTitle: "Page not found",
} as const;
