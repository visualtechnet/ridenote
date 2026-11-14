/** @jest-environment node */

const mockCreate = jest.fn();
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: class {
    messages = { create: mockCreate };
  },
}));

import { jsonContent } from "../../../tests/model-reply";
import { toolReply } from "@/lib/agent/test-model";
import { DEVELOPMENT_SECRET } from "@/lib/agent/secret";
import { sign } from "@/lib/agent/sign";
import { POST } from "./route";

const NOTE = "James O'Neil to County Hospital tomorrow at 9am";
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const trip = {
  passenger_name: "James O'Neil",
  pickup_location: "7 Harbor Rd",
  dropoff_location: "County Hospital",
  pickup_date: tomorrow,
  pickup_time: "09:00",
  mobility: [],
  missing_fields: [],
  notes: "",
};

let ip = 0;
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `10.9.0.${++ip}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Extraction gets the trip; each agent step is answered from the queue in order. */
function answerWith(agentReplies: unknown[]) {
  mockCreate.mockReset();
  mockCreate.mockImplementation(async (params: { tool_choice?: unknown }) => {
    if (!params.tool_choice)
      return {
        content: jsonContent(trip),
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      };
    return agentReplies.shift();
  });
}

async function events(res: Response) {
  return (await res.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { type: string; status?: string });
}

describe("POST /api/agent", () => {
  beforeEach(() => {
    mockCreate.mockClear();
    delete process.env.DRAFT_SIGNING_SECRET;
    delete process.env.VERCEL_ENV;
    delete process.env.E2E_STUB_PARSE;
    delete process.env.HISTORY_STORE;
  });

  it("streams a proposed run: the steps, then one proposal with a signed draft", async () => {
    answerWith([
      toolReply([{ name: "find_rider", input: { name: "James O'Neil" } }]),
      toolReply([
        {
          name: "propose_trip",
          input: { rider_id: "r3", pickup_date: tomorrow, pickup_time: "09:00", reasons: [] },
        },
      ]),
    ]);
    const res = await POST(request({ note: NOTE, timeZone: "UTC" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const text = await res.clone().text();
    const seen = await events(new Response(text));
    expect(seen.map((e) => e.type)).toEqual(["run_started", "parsed", "step", "step", "ended"]);
    expect(seen.at(-1)).toMatchObject({ status: "proposed" });
    // The trip the page shows is data it already holds; the note itself never crosses the stream.
    expect(text).not.toContain("tomorrow at 9am");
  });

  it("answers a question with options and a resume token", async () => {
    answerWith([
      toolReply([{ name: "find_rider", input: { name: "James O'Neil" } }]),
      toolReply([
        {
          name: "ask_dispatcher",
          input: { question: "Which?", options: [{ label: "Pick a rider", rider_id: null }] },
        },
      ]),
    ]);
    const res = await POST(request({ note: NOTE, timeZone: "UTC" }));
    const seen = await events(res);
    expect(seen.at(-1)).toMatchObject({ type: "ended", status: "needs_info" });
  });

  it("refuses a body that is not JSON or has no note", async () => {
    expect((await POST(request("{not json"))).status).toBe(400);
    expect((await POST(request({ timeZone: "UTC" }))).status).toBe(400);
  });

  it("refuses a request that is not JSON by content type", async () => {
    const req = new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "text/plain", "x-real-ip": "10.9.1.1" },
      body: "hi",
    });
    expect((await POST(req)).status).toBe(415);
  });

  it("refuses a body that is too large", async () => {
    const res = await POST(request("x", { "content-length": "999999999" }));
    expect(res.status).toBe(413);
  });

  it("answers 503 in production when the signing secret is missing", async () => {
    process.env.VERCEL_ENV = "production";
    const res = await POST(request({ note: NOTE, timeZone: "UTC" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "unavailable" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("refuses a forged resume token before any model call", async () => {
    answerWith([]);
    const res = await POST(request({ resume: { token: "a.b", choice: 0 }, timeZone: "UTC" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "bad_signature" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("refuses a choice that is not a whole number in range", async () => {
    const res = await POST(request({ resume: { token: "a.b", choice: 9 } }));
    expect(res.status).toBe(400);
  });

  it("answers 429 once this client has used its runs for the minute", async () => {
    const same = { "x-real-ip": "10.9.2.2" };
    answerWith(
      Array.from({ length: 10 }, () =>
        toolReply([{ name: "find_rider", input: { name: "Nobody Here" } }]),
      ),
    );
    let last: Response | undefined;
    for (let i = 0; i < 6; i += 1)
      last = await POST(request({ note: NOTE, timeZone: "UTC" }, same));
    expect(last?.status).toBe(429);
  });

  it("resumes after a question: the chosen rider is proposed without a new parse", async () => {
    const token = sign(
      {
        v: 1,
        kind: "resume",
        run_id: "run-0",
        parsed: { ...trip, pickup_date: tomorrow, pickup_time: "09:00" },
        question: "Which?",
        options: [{ label: "James O'Neil, 7 Harbor Rd", rider_id: "r3" }],
        exp: Date.now() + 60_000,
      },
      DEVELOPMENT_SECRET,
    );
    answerWith([
      toolReply([
        {
          name: "propose_trip",
          input: { rider_id: "r3", pickup_date: tomorrow, pickup_time: "09:00", reasons: [] },
        },
      ]),
    ]);
    const res = await POST(request({ resume: { token, choice: 0 }, timeZone: "UTC" }));
    const seen = await events(res);
    expect(seen.map((e) => e.type)).toEqual(["run_started", "parsed", "step", "ended"]);
    expect(seen.at(-1)).toMatchObject({ status: "proposed" });
    // Only the agent's call happened: the resume does not parse the note again.
    expect(mockCreate.mock.calls.every(([p]) => p.tool_choice !== undefined)).toBe(true);
  });

  it("runs the browser-test stand-ins under the stub, and never the real model", async () => {
    process.env.E2E_STUB_PARSE = "1";
    const e2e = {
      passenger_name: "James O'Neil",
      pickup_location: "7 Harbor Rd",
      dropoff_location: "County Hospital",
      pickup_date: tomorrow,
      pickup_time: "09:00",
      mobility: [],
      missing_fields: [],
      notes: "",
    };
    mockCreate.mockClear();
    const res = await POST(request({ note: `E2E:${JSON.stringify(e2e)}`, timeZone: "UTC" }));
    const seen = await events(res);
    expect(seen.at(-1)).toMatchObject({ status: "proposed" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("answers 503 when the agent's model is one that cannot force a tool", async () => {
    process.env.AGENT_MODEL = "claude-sonnet-5-5";
    try {
      const res = await POST(request({ note: NOTE, timeZone: "UTC" }));
      expect(res.status).toBe(503);
    } finally {
      delete process.env.AGENT_MODEL;
    }
  });

  it("answers busy when every run slot is taken, and frees them when the streams are cancelled", async () => {
    // Agent calls that wait until their run is aborted, so the slots stay taken.
    mockCreate.mockReset();
    mockCreate.mockImplementation(
      (params: { tool_choice?: unknown }, options: { signal: AbortSignal }) => {
        if (!params.tool_choice) {
          return Promise.resolve({
            content: jsonContent(trip),
            stop_reason: "end_turn",
            usage: { input_tokens: 1, output_tokens: 1 },
          });
        }
        return new Promise((_resolve, reject) =>
          options.signal.addEventListener("abort", () => reject(new Error("aborted"))),
        );
      },
    );
    const held: Response[] = [];
    for (let i = 0; i < 10; i += 1) held.push(await POST(request({ note: NOTE, timeZone: "UTC" })));
    const refused = await POST(request({ note: NOTE, timeZone: "UTC" }));
    expect(refused.status).toBe(503);
    expect(await refused.json()).toMatchObject({
      error: "The agent is busy. Try again in a moment.",
    });

    for (const res of held) await res.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const after = await POST(request({ note: NOTE, timeZone: "UTC" }));
    expect(after.status).toBe(200);
    await after.body?.cancel();
  });

  it("answers busy once the shared model-call budget for the minute is spent", async () => {
    answerWith([]);
    mockCreate.mockImplementation(async (params: { tool_choice?: unknown }) => {
      if (!params.tool_choice)
        return {
          content: jsonContent(trip),
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        };
      return toolReply([{ name: "find_rider", input: { name: "Nobody Here" } }]);
    });
    let refused: Response | undefined;
    for (let i = 0; i < 80 && !refused; i += 1) {
      const res = await POST(request({ note: NOTE, timeZone: "UTC" }));
      if (res.status === 503) refused = res;
      else await res.body?.cancel();
    }
    expect(refused?.status).toBe(503);
    expect(refused?.headers.get("Retry-After")).toMatch(/^\d+$/);
  });
});
