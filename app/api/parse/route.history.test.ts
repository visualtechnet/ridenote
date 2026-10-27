/** @jest-environment node */

const mockParse = jest.fn();
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: class {
    messages = { parse: mockParse };
  },
}));

const mockSaveEntry = jest.fn();
jest.mock("@/lib/history", () => ({ saveEntry: (...args: unknown[]) => mockSaveEntry(...args) }));

// Run the callback at once, as if the response had already been sent.
const mockAfter = jest.fn((cb: () => unknown) => {
  void cb();
});
jest.mock("next/server", () => ({ after: (cb: () => unknown) => mockAfter(cb) }));

import { BUDGET, HTTP, RATE_LIMIT } from "@/lib/config";
import { MESSAGES } from "@/lib/messages";
import { POST } from "./route";

const goodTrip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
  pickup_time: "09:30",
  mobility: ["wheelchair"],
  missing_fields: [],
  notes: "",
};

let ipCounter = 0;
function request(body: unknown, ip = `10.1.0.${++ipCounter}`) {
  return new Request("http://localhost/api/parse", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const goodResult = { stop_reason: "end_turn", parsed_output: goodTrip, usage: {} };

beforeEach(() => {
  mockParse.mockReset();
  mockParse.mockResolvedValue(goodResult);
  mockSaveEntry.mockReset();
  mockSaveEntry.mockResolvedValue(undefined);
  mockAfter.mockReset();
  mockAfter.mockImplementation((cb) => {
    void cb();
  });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/parse history save", () => {
  it("saves the returned trip once after a successful parse", async () => {
    const res = await POST(request({ note: "Pick up Mrs. Lee at 12 Oak St" }));
    expect(res.status).toBe(200);
    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockSaveEntry).toHaveBeenCalledTimes(1);
    expect(mockSaveEntry).toHaveBeenCalledWith(goodTrip);
  });

  it("saves once for identical notes submitted at the same moment", async () => {
    let finish!: () => void;
    mockParse.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(goodResult);
        }),
    );
    const note = "Pick up the Garcia family at 5 Birch Ln";
    const pending = [POST(request({ note })), POST(request({ note })), POST(request({ note }))];
    await new Promise((r) => setTimeout(r, 10));
    finish();
    const results = await Promise.all(pending);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(mockSaveEntry).toHaveBeenCalledTimes(1);
  });

  it("never passes the raw note to saveEntry", async () => {
    const note = "Pick up Mrs. Lee at 12 Oak St, call 555-0100 SECRETWORD";
    await POST(request({ note }));
    const arg = mockSaveEntry.mock.calls[0][0];
    expect(arg).not.toHaveProperty("note");
    expect(JSON.stringify(arg)).not.toContain("SECRETWORD");
    expect(JSON.stringify(arg)).not.toContain(note);
  });

  it("saves nothing for a validation refusal", async () => {
    const res = await POST(request({ note: "" }));
    expect(res.status).toBe(HTTP.badRequest);
    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockSaveEntry).not.toHaveBeenCalled();
  });

  it("saves nothing for a rate-limited request", async () => {
    const ip = "10.9.9.9";
    let last!: Response;
    for (let i = 0; i <= RATE_LIMIT.maxRequests; i++) {
      last = await POST(request({ note: `Pick up Lee number ${i} at 12 Oak St` }, ip));
    }
    expect(last.status).toBe(HTTP.tooManyRequests);
    expect(mockSaveEntry).toHaveBeenCalledTimes(RATE_LIMIT.maxRequests);
  });

  it("saves nothing when the server is busy (503)", async () => {
    const releases: Array<() => void> = [];
    mockParse.mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(() => resolve(goodResult));
        }),
    );
    const held = Array.from({ length: BUDGET.maxConcurrent }, (_, i) =>
      POST(request({ note: `Busy note ${i} for Lee at 12 Oak St` })),
    );
    await new Promise((r) => setTimeout(r, 10));
    const busy = await POST(request({ note: "One too many for Kim at 9 Elm St" }));
    expect(busy.status).toBe(HTTP.unavailable);
    expect(mockSaveEntry).not.toHaveBeenCalled();
    releases.forEach((r) => r());
    await Promise.all(held);
    expect(mockSaveEntry).toHaveBeenCalledTimes(BUDGET.maxConcurrent);
  });

  it("saves nothing when the upstream call fails (502)", async () => {
    mockParse.mockRejectedValue(new Error("boom"));
    const res = await POST(request({ note: "Pick up Mrs. Lee at 12 Oak St" }));
    expect(res.status).toBe(HTTP.badGateway);
    expect(mockSaveEntry).not.toHaveBeenCalled();
  });

  it("saves nothing when the AI account is out of credit", async () => {
    mockParse.mockRejectedValue(
      Object.assign(new Error("400 Your credit balance is too low."), {
        status: 400,
        type: "invalid_request_error",
      }),
    );
    const res = await POST(request({ note: "Pick up Mrs. Lee at 12 Oak St" }));
    expect(await res.json()).toEqual({ error: MESSAGES.outOfCredit, code: "out_of_credit" });
    expect(mockSaveEntry).not.toHaveBeenCalled();
  });

  it("answers the same when saveEntry rejects", async () => {
    mockSaveEntry.mockRejectedValue(new Error("db down"));
    const res = await POST(request({ note: "Pick up Mrs. Lee at 12 Oak St" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ trip: goodTrip });
  });

  it("answers the same when saveEntry throws synchronously", async () => {
    mockSaveEntry.mockImplementation(() => {
      throw new Error("db down");
    });
    mockAfter.mockImplementation((cb) => {
      cb();
    });
    const res = await POST(request({ note: "Pick up Mrs. Lee at 12 Oak St" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ trip: goodTrip });
  });

  it("answers the same when after itself throws", async () => {
    mockAfter.mockImplementation(() => {
      throw new Error("outside a request scope");
    });
    const res = await POST(request({ note: "Pick up Mrs. Lee at 12 Oak St" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ trip: goodTrip });
    expect(mockSaveEntry).not.toHaveBeenCalled();
  });
});
