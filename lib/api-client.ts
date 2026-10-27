import { CLIENT, HTTP } from "./config";
import { MESSAGES } from "./messages";
import { Routes } from "./routes";
import { TripSchema, type Trip } from "./trip";

/** Longest server-provided message we will show. Anything longer is cut, never trusted. */
const MAX_SERVER_MESSAGE_LENGTH = 200;

/** An error whose message is safe to show to the person using the page. */
export class ParseError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

/** Sends a note to the API and returns a validated trip. Throws ParseError on any failure. */
export async function parseNote(note: string): Promise<Trip> {
  let res: Response;
  try {
    res = await fetch(Routes.api("parse"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
      signal: AbortSignal.timeout(CLIENT.timeoutMs),
    });
  } catch (err) {
    if ((err as { name?: string } | null)?.name === "TimeoutError") {
      throw new ParseError(MESSAGES.timeout);
    }
    throw new ParseError(MESSAGES.network);
  }

  const data = await res.json().catch(() => null);

  if (res.status === HTTP.tooManyRequests) {
    const wait = Number(res.headers?.get("Retry-After"));
    if (Number.isInteger(wait) && wait > 0) {
      throw new ParseError(MESSAGES.tooManyRequestsIn(wait), res.status);
    }
    // The edge can refuse with no body and no Retry-After; any 429 means "slow down".
    throw new ParseError(MESSAGES.tooManyRequests, res.status);
  }

  if (!res.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error.slice(0, MAX_SERVER_MESSAGE_LENGTH)
        : MESSAGES.parseFailed;
    throw new ParseError(message, res.status);
  }

  // The server already checked this, but data crossing the network is validated again on arrival.
  const trip = TripSchema.safeParse(data?.trip);
  if (!trip.success) throw new ParseError(MESSAGES.parseFailed, res.status);
  return trip.data;
}
