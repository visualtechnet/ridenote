/** @jest-environment node */

// The whole path with nothing in between mocked except the model and the "after the response" hook:
// POST /api/parse -> real saveEntry -> real in-memory store -> real loadHistory -> History cards.

const mockParse = jest.fn();
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: class {
    messages = { create: mockParse };
  },
}));
jest.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    pending.push(Promise.resolve(cb()));
  },
}));

import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { POST } from "@/app/api/parse/route";
import { HistoryList } from "@/components/HistoryList";
import { COPY } from "@/lib/messages";
import { loadHistory } from "@/lib/history";
import { getMemoryStore } from "@/lib/history-memory";
import { jsonContent } from "@/tests/model-reply";

const pending: Promise<unknown>[] = [];

const trip = (name: string) => ({
  passenger_name: name,
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
  pickup_time: "09:30",
  mobility: ["wheelchair"],
  notes: "",
});

let ip = 0;
const post = (note: string) =>
  POST(
    new Request("http://localhost/api/parse", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.5.0.${++ip}` },
      body: JSON.stringify({ note }),
    }),
  );

/** A model answer that takes `ms` to arrive and reports `output` output tokens. */
const answer = (name: string, output: number, ms: number) => async () => {
  await new Promise((r) => setTimeout(r, ms));
  return {
    stop_reason: "end_turn",
    content: jsonContent(trip(name)),
    usage: { input_tokens: 300, output_tokens: output },
  };
};

const original = { ...process.env };
beforeAll(() => {
  Object.assign(process.env, {
    VERCEL_ENV: "production",
    HISTORY_DATABASE_URL: "memory://test",
    HISTORY_STORE: "memory",
  });
});
afterAll(() => {
  process.env = original;
});
beforeEach(() => {
  getMemoryStore().rows.length = 0;
  pending.length = 0;
  mockParse.mockReset();
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("usage from the API to the History page", () => {
  it("returns the same numbers it saves, and History shows them", async () => {
    mockParse.mockImplementation(answer("Mrs. Lee", 160, 20));
    const res = await post("Pick up Mrs. Lee");
    const body = await res.json();
    await Promise.all(pending);

    const loaded = await loadHistory();
    expect(loaded.status).toBe("ok");
    const rows = loaded.status === "ok" ? loaded.rows : [];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      input_tokens: body.usage.inputTokens,
      output_tokens: body.usage.outputTokens,
      latency_ms: body.usage.latencyMs,
    });
    expect(body.usage.inputTokens).toBe(300);
    expect(body.usage.outputTokens).toBe(160);
    expect(body.usage.latencyMs).toBeGreaterThanOrEqual(15);

    const html = renderToStaticMarkup(createElement(HistoryList, { rows }));
    expect(html).toContain(`300 in · 160 out · ${body.usage.latencyMs} ms`);
  });

  it("rates the heavy, slow call as problematic and a light, quick one as efficient", async () => {
    const calls: [string, number, number][] = [
      ["Quick One", 100, 1],
      ["Typical A", 120, 40],
      ["Typical B", 120, 40],
      ["Typical C", 140, 40],
      ["Typical D", 140, 40],
      ["Heavy Slow", 450, 300],
    ];
    for (const [name, output, ms] of calls) {
      mockParse.mockImplementationOnce(answer(name, output, ms));
      await post(`Pick up ${name}`);
    }
    await Promise.all(pending);

    const loaded = await loadHistory();
    const rows = loaded.status === "ok" ? loaded.rows : [];
    const html = renderToStaticMarkup(createElement(HistoryList, { rows }));
    const cardOf = (name: string) =>
      html.split("<article")[1 + rows.findIndex((r) => r.passenger_name === name)];

    expect(cardOf("Heavy Slow")).toContain(COPY.ratingProblematic);
    expect(cardOf("Quick One")).toContain(COPY.ratingEfficient);
    expect(html).toContain("median");
  });

  it("saves nothing, and returns an error with no usage, when the model refuses", async () => {
    mockParse.mockResolvedValue({
      stop_reason: "refusal",
      content: [],
      usage: { input_tokens: 10, output_tokens: 1 },
    });
    const res = await post("Pick up someone");
    const body = await res.json();
    await Promise.all(pending);
    expect(body.usage).toBeUndefined();
    expect(getMemoryStore().rows).toHaveLength(0);
  });
});
