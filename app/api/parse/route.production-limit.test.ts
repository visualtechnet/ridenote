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
jest.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    void cb();
  },
}));

import { HTTP, RATE_LIMIT } from "@/lib/config";

const goodTrip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
  pickup_time: "09:30",
  mobility: ["wheelchair"],
  missing_fields: [],
  notes: "",
};

let noteCounter = 0;
function request(headers: Record<string, string>) {
  return new Request("http://localhost/api/parse", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ note: `Pick up Lee number ${++noteCounter} at 12 Oak St` }),
  });
}

// The limiter is built when the route module loads, so production is set before each fresh import.
async function loadPost() {
  jest.resetModules();
  process.env.VERCEL_ENV = "production";
  return (await import("./route")).POST;
}

const originalEnv = process.env.VERCEL_ENV;
afterAll(() => {
  if (originalEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalEnv;
});

beforeEach(() => {
  mockParse.mockReset();
  mockParse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: goodTrip, usage: {} });
  mockSaveEntry.mockReset();
  mockSaveEntry.mockResolvedValue(undefined);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/parse in production", () => {
  it("allows three a minute from one IP and refuses the fourth before any model call or save", async () => {
    const POST = await loadPost();
    const headers = { "x-real-ip": "203.0.113.1" };
    const statuses: number[] = [];
    let last!: Response;
    for (let i = 0; i < 4; i++) {
      last = await POST(request(headers));
      statuses.push(last.status);
    }
    expect(statuses).toEqual([200, 200, 200, HTTP.tooManyRequests]);
    expect(last.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(mockParse).toHaveBeenCalledTimes(3);
    expect(mockSaveEntry).toHaveBeenCalledTimes(3);
  });

  it("counts another IP separately in the same minute", async () => {
    const POST = await loadPost();
    for (let i = 0; i < 4; i++) await POST(request({ "x-real-ip": "203.0.113.2" }));
    const other = await POST(request({ "x-real-ip": "203.0.113.3" }));
    expect(other.status).toBe(200);
  });

  it("limits requests with no client IP header at 10, not 3, so the shared bucket cannot lock everyone out", async () => {
    const POST = await loadPost();
    const statuses: number[] = [];
    for (let i = 0; i <= RATE_LIMIT.maxRequests; i++) {
      statuses.push((await POST(request({}))).status);
    }
    expect(statuses.slice(0, RATE_LIMIT.maxRequests)).toEqual(
      Array(RATE_LIMIT.maxRequests).fill(200),
    );
    expect(statuses[RATE_LIMIT.maxRequests]).toBe(HTTP.tooManyRequests);
  });
});
