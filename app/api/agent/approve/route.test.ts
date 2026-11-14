/** @jest-environment node */

import { makeTrip } from "../../../../tests/test-utils";
import { DEVELOPMENT_SECRET } from "@/lib/agent/secret";
import { sign } from "@/lib/agent/sign";
import { getMemoryStore } from "@/lib/history-memory";
import { HISTORY } from "@/lib/config";
import { POST } from "./route";

const HISTORY_ON = {
  VERCEL_ENV: "production",
  HISTORY_DATABASE_URL: "memory://test",
  HISTORY_STORE: "memory",
  DRAFT_SIGNING_SECRET: DEVELOPMENT_SECRET,
};
const exp = () => Date.now() + 60_000;
let ip = 0;

const draftFor = (over: Record<string, unknown> = {}, secret = DEVELOPMENT_SECRET) =>
  sign(
    {
      v: 1,
      kind: "draft",
      draft_id: `draft-${++ip}`,
      run_id: "run",
      trip: makeTrip({ passenger_name: "Jo", pickup_date: "2026-11-20", pickup_time: "09:00" }),
      sources: { pickup: "note", mobility: "none" },
      conflicts: [],
      exp: exp(),
      ...over,
    },
    secret,
  );

function request(body: unknown) {
  return new Request("http://localhost/api/agent/approve", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `10.8.0.${++ip}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const envBefore = { ...process.env };

describe("POST /api/agent/approve", () => {
  beforeEach(() => {
    process.env = { ...envBefore };
    delete process.env.VERCEL_ENV;
    delete process.env.HISTORY_DATABASE_URL;
    delete process.env.HISTORY_STORE;
    delete process.env.DRAFT_SIGNING_SECRET;
  });
  afterAll(() => {
    process.env = envBefore;
  });

  it("saves a signed draft once and says already saved on a replay", async () => {
    Object.assign(process.env, HISTORY_ON);
    const draft = draftFor();
    const before = getMemoryStore().rows.length;
    const first = await POST(request({ draft }));
    expect(await first.json()).toMatchObject({ status: "saved" });
    const replay = await POST(request({ draft }));
    expect(await replay.json()).toMatchObject({ status: "already_saved" });
    expect(getMemoryStore().rows.length).toBe(before + 1);
  });

  it("says History is off outside production, and saves nothing", async () => {
    const res = await POST(request({ draft: draftFor() }));
    expect(await res.json()).toMatchObject({ status: "history_off" });
  });

  it("refuses a draft whose signature does not match", async () => {
    const res = await POST(request({ draft: draftFor({}, "y".repeat(40)) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "bad_signature" });
  });

  it("refuses an expired draft", async () => {
    const res = await POST(request({ draft: draftFor({ exp: Date.now() - 1 }) }));
    expect(await res.json()).toMatchObject({ code: "expired" });
  });

  it("refuses a signed draft whose trip is not a valid trip", async () => {
    const res = await POST(request({ draft: draftFor({ trip: { passenger_name: 3 } }) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid" });
  });

  it("refuses a body with no draft", async () => {
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request("{nope"))).status).toBe(400);
  });

  it("refuses a request that is not JSON", async () => {
    const req = new Request("http://localhost/api/agent/approve", {
      method: "POST",
      headers: { "content-type": "text/plain", "x-real-ip": "10.8.9.9" },
      body: "x",
    });
    expect((await POST(req)).status).toBe(415);
  });

  it("answers 503 in production when the signing secret is missing", async () => {
    process.env.VERCEL_ENV = "production";
    const res = await POST(request({ draft: draftFor() }));
    expect(res.status).toBe(503);
  });

  it("refuses a draft that is too large", async () => {
    const res = await POST(
      new Request("http://localhost/api/agent/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "99999999",
          "x-real-ip": "10.8.8.8",
        },
        body: "{}",
      }),
    );
    expect(res.status).toBe(413);
  });

  it("says so when the daily cap is full, and nothing is saved", async () => {
    Object.assign(process.env, HISTORY_ON);
    const store = getMemoryStore();
    for (let i = 0; i < HISTORY.dailySaveCap; i += 1) {
      await store.insert(
        {
          passenger_name: null,
          pickup_location: null,
          dropoff_location: null,
          pickup_date: null,
          pickup_time: null,
          mobility: ["walker"],
        },
        HISTORY.dailySaveCap + 1,
      );
    }
    const res = await POST(request({ draft: draftFor() }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "capped" });
    store.rows.length = 0;
  });

  it("says nothing was saved when the trip had nothing worth saving", async () => {
    Object.assign(process.env, HISTORY_ON);
    const empty = makeTrip({
      passenger_name: null,
      pickup_location: null,
      dropoff_location: null,
      mobility: [],
    });
    const res = await POST(request({ draft: draftFor({ trip: empty }) }));
    expect(await res.json()).toMatchObject({ status: "nothing_to_save" });
  });

  it("answers with a plain error when the save throws, naming no detail", async () => {
    Object.assign(process.env, HISTORY_ON);
    const store = getMemoryStore();
    const real = store.insertDraft;
    store.insertDraft = async () => {
      throw new Error("db at secret-host");
    };
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const res = await POST(request({ draft: draftFor() }));
      expect(res.status).toBe(503);
      expect(await res.text()).not.toContain("secret-host");
    } finally {
      store.insertDraft = real;
    }
  });
});
