/** @jest-environment node */

// Tiny budgets so the shared limits can be reached in a test.
jest.mock("@/lib/config", () => {
  const actual = jest.requireActual("@/lib/config");
  return {
    ...actual,
    RATE_LIMIT: { ...actual.RATE_LIMIT, maxRequests: 1000 },
    BUDGET: { maxCallsPerWindow: 3, windowMs: 60_000, maxConcurrent: 2 },
  };
});

const mockParse = jest.fn();
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: class {
    messages = { parse: mockParse };
  },
}));

import { POST } from "./route";

const goodTrip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: null,
  pickup_time: "09:30",
  mobility: "wheelchair",
  missing_fields: ["dropoff_location"],
  notes: "",
};

let n = 0;
const request = (note: string) =>
  new Request("http://localhost/api/parse", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.1.1.${++n}` },
    body: JSON.stringify({ note }),
  });

const ok = () => ({ stop_reason: "end_turn", parsed_output: goodTrip, usage: {} });

beforeEach(() => {
  mockParse.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("shared protection against many clients at once", () => {
  it("limits how many upstream calls run at the same time, answering 503 with Retry-After", async () => {
    const releases: (() => void)[] = [];
    mockParse.mockImplementation(
      () => new Promise((resolve) => releases.push(() => resolve(ok()))),
    );
    // Distinct notes, so nothing is coalesced. The gate allows 2; the third is turned away.
    const a = POST(request("Pick up Lee at 1 First St"));
    const b = POST(request("Pick up Kim at 2 Second St"));
    await new Promise((r) => setTimeout(r, 10));
    const c = await POST(request("Pick up Ana at 3 Third St"));

    expect(c.status).toBe(503);
    expect(Number(c.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(mockParse).toHaveBeenCalledTimes(2);

    releases.forEach((release) => release());
    expect((await a).status).toBe(200);
    expect((await b).status).toBe(200);

    // A slot is free again afterwards (this is the 3rd and last call of the budget).
    mockParse.mockResolvedValue(ok());
    expect((await POST(request("Pick up Sam at 4 Fourth St"))).status).toBe(200);
  });

  it("stops calling the paid upstream once the shared budget for the window is spent", async () => {
    mockParse.mockResolvedValue(ok());
    const before = mockParse.mock.calls.length;
    const res = await POST(request("Pick up Zed at 5 Fifth St"));
    expect(res.status).toBe(503);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(mockParse.mock.calls.length).toBe(before);
    expect((await res.json()).error).toMatch(/lot of requests/i);
  });

  it("still rejects bad input with 400 when the budget is spent, since that costs nothing", async () => {
    const res = await POST(request(""));
    expect(res.status).toBe(400);
  });
});
