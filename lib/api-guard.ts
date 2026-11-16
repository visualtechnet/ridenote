import { HTTP } from "./config";
import { MESSAGES } from "./messages";

type Handler<A extends unknown[]> = (req: Request, ...args: A) => Promise<Response>;

/**
 * The last line of defence for an API route. A route is written to answer every expected failure
 * with a typed JSON error; anything it did not expect (a bug, a runtime fault) becomes a JSON 503
 * with a retry hint, never an HTML 500 page. Only the error's name is logged: its message can carry
 * a note or driver detail. A caller that has already gone away gets a quiet 499, not a failure.
 */
export function guardRoute<A extends unknown[]>(route: string, handler: Handler<A>): Handler<A> {
  return async (req, ...args) => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      if (req.signal.aborted) return new Response(null, { status: HTTP.clientClosed });
      console.error(
        `${route} failed unexpectedly:`,
        err instanceof Error ? err.name : "unknown error",
      );
      return Response.json(
        { error: MESSAGES.unexpected, code: "unavailable" },
        {
          status: HTTP.unavailable,
          headers: { "Cache-Control": "no-store", "Retry-After": "5" },
        },
      );
    }
  };
}
