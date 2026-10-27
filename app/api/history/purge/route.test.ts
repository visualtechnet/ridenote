/** @jest-environment node */
import fs from "node:fs";
import path from "node:path";

const mockPurge = jest.fn();
jest.mock("@/lib/history-purge", () => ({
  getPurger: () => ({ purgeOlderThan: (...args: unknown[]) => mockPurge(...args) }),
}));

import { HISTORY, HTTP } from "@/lib/config";
import { Routes } from "@/lib/routes";
import { GET } from "./route";

const SECRET = "s3cret-value-for-tests";
const env = process.env as Record<string, string | undefined>;
const saved = { ...env };

function call(authorization?: string) {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  return GET(new Request("http://localhost/api/history/purge", { headers }));
}

beforeEach(() => {
  mockPurge.mockReset();
  mockPurge.mockResolvedValue(3);
  env.CRON_SECRET = SECRET;
  env.VERCEL_ENV = "production";
  env.HISTORY_DATABASE_URL = "postgres://app@example/db";
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ["CRON_SECRET", "VERCEL_ENV", "HISTORY_DATABASE_URL"]) {
    if (saved[k] === undefined) delete env[k];
    else env[k] = saved[k];
  }
  jest.restoreAllMocks();
});

describe("GET /api/history/purge: authorization", () => {
  it.each([
    ["no header", undefined],
    ["wrong secret", "Bearer nope"],
    ["same length, wrong secret", `Bearer ${"x".repeat(SECRET.length)}`],
    ["secret without the Bearer prefix", SECRET],
    ["lower-case scheme", `bearer ${SECRET}`],
    ["extra text after the secret", `Bearer ${SECRET} extra`],
    ["empty header", ""],
  ])("401 for %s, and the purger is never called", async (_name, header) => {
    const res = await call(header);
    expect(res.status).toBe(HTTP.unauthorized);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: expect.any(String) });
    expect(mockPurge).not.toHaveBeenCalled();
  });

  it("401 for every request when CRON_SECRET is unset, even with a header that 'matches' nothing", async () => {
    delete env.CRON_SECRET;
    for (const header of [undefined, "Bearer ", "Bearer undefined", "Bearer"]) {
      expect((await call(header)).status).toBe(HTTP.unauthorized);
    }
    expect(mockPurge).not.toHaveBeenCalled();
  });

  it("401 for every request when CRON_SECRET is empty", async () => {
    env.CRON_SECRET = "";
    for (const header of [undefined, "Bearer ", "Bearer"]) {
      expect((await call(header)).status).toBe(HTTP.unauthorized);
    }
    expect(mockPurge).not.toHaveBeenCalled();
  });

  it("checks the secret before the production gate", async () => {
    delete env.VERCEL_ENV;
    const res = await call("Bearer wrong");
    expect(res.status).toBe(HTTP.unauthorized);
    expect(await res.json()).not.toHaveProperty("skipped");
  });
});

describe("GET /api/history/purge: with the correct secret", () => {
  it("in production purges the retention window and returns the count", async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(HTTP.ok);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ deleted: 3 });
    expect(mockPurge).toHaveBeenCalledWith(HISTORY.retentionDays);
    expect(HISTORY.retentionDays).toBe(7);
  });

  it("outside production does nothing and does not call the purger", async () => {
    env.VERCEL_ENV = "preview";
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(HTTP.ok);
    expect(await res.json()).toEqual({ deleted: 0, skipped: true });
    expect(mockPurge).not.toHaveBeenCalled();
  });

  it("in production without a history database does nothing", async () => {
    delete env.HISTORY_DATABASE_URL;
    expect(await (await call(`Bearer ${SECRET}`)).json()).toEqual({ deleted: 0, skipped: true });
    expect(mockPurge).not.toHaveBeenCalled();
  });

  it("returns 500 with a generic body when the purger throws, and logs only the error name", async () => {
    const err = new Error(`boom ${SECRET} passenger Jane Roe`);
    err.name = "NeonDbError";
    mockPurge.mockRejectedValue(err);
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(HTTP.serverError);
    const text = await res.text();
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("Jane");
    expect(text).not.toContain("boom");
    expect(JSON.parse(text)).toEqual({ error: expect.any(String) });
    const logged = JSON.stringify((console.error as jest.Mock).mock.calls);
    expect(logged).toContain("NeonDbError");
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain("Jane");
    expect(logged).not.toContain("boom");
  });
});

describe("vercel.json", () => {
  const config = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../../../vercel.json"), "utf8"),
  );

  it("has exactly one cron, a daily call to the purge route", () => {
    expect(config.crons).toEqual([{ path: Routes.api("historyPurge"), schedule: "0 4 * * *" }]);
  });
});
