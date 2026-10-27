/** @jest-environment node */
import { ParseError, parseNote } from "./api-client";
import { MESSAGES } from "./messages";
import { Routes } from "./routes";

const trip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: null,
  pickup_time: "09:30",
  mobility: ["wheelchair"],
  missing_fields: ["dropoff_location"],
  notes: "",
};

const fetchMock = jest.fn();
const originalFetch = global.fetch;
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = originalFetch;
});

const respond = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => body });

describe("parseNote", () => {
  it("POSTs the note as JSON to the parse route", async () => {
    respond({ trip });
    await parseNote("Pick up Lee");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(Routes.api("parse"));
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ note: "Pick up Lee" });
  });

  it("returns the validated trip", async () => {
    respond({ trip });
    await expect(parseNote("Pick up Lee")).resolves.toEqual(trip);
  });

  it("throws a ParseError carrying the server's message and status", async () => {
    respond({ error: "Too many requests." }, 429);
    await expect(parseNote("Pick up Lee")).rejects.toMatchObject({
      name: "ParseError",
      message: "Too many requests.",
      status: 429,
    });
  });

  it("cuts an over-long server message instead of showing it all", async () => {
    respond({ error: "x".repeat(5000) }, 500);
    const err = await parseNote("Pick up Lee").catch((e: ParseError) => e);
    expect((err as ParseError).message.length).toBeLessThanOrEqual(200);
  });

  it("uses a generic message when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    await expect(parseNote("Pick up Lee")).rejects.toThrow(MESSAGES.parseFailed);
  });

  it("reports a network failure in plain language", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(parseNote("Pick up Lee")).rejects.toThrow(MESSAGES.network);
  });

  it("rejects a response whose trip has the wrong shape", async () => {
    respond({ trip: { passenger_name: "X" } });
    await expect(parseNote("Pick up Lee")).rejects.toThrow(MESSAGES.parseFailed);
  });

  it("rejects a response with no trip at all", async () => {
    respond({});
    await expect(parseNote("Pick up Lee")).rejects.toThrow(MESSAGES.parseFailed);
  });

  it("gives the request a timeout signal so it cannot hang forever", async () => {
    respond({ trip });
    await parseNote("Pick up Lee");
    const { signal } = fetchMock.mock.calls[0][1];
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("shows a timeout message when the request times out", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    await expect(parseNote("Pick up Lee")).rejects.toMatchObject({ message: MESSAGES.timeout });
  });

  it("still reports a network failure for other fetch errors", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(parseNote("Pick up Lee")).rejects.toMatchObject({ message: MESSAGES.network });
  });

  it("tells the user how long to wait when the server sends Retry-After", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "42" }),
      json: async () => ({ error: MESSAGES.tooManyRequests }),
    });
    await expect(parseNote("Pick up Lee")).rejects.toMatchObject({
      message: MESSAGES.tooManyRequestsIn(42),
      status: 429,
    });
  });

  it.each(["abc", "0", "-5", "1.5", ""])(
    "falls back to the server message when Retry-After is %j",
    async (value) => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": value }),
        json: async () => ({ error: MESSAGES.tooManyRequests }),
      });
      await expect(parseNote("Pick up Lee")).rejects.toMatchObject({
        message: MESSAGES.tooManyRequests,
      });
    },
  );
});
