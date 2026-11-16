/** @jest-environment node */
import { guardRoute } from "./api-guard";

describe("guardRoute", () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  const request = (signal?: AbortSignal) =>
    ({ signal: signal ?? new AbortController().signal }) as Request;

  it("passes a normal response through untouched", async () => {
    const route = guardRoute("test", async () => Response.json({ ok: true }, { status: 201 }));
    const res = await route(request());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("turns an unexpected throw into a JSON 503 with a retry hint, never a 500", async () => {
    const route = guardRoute("test", async () => {
      throw new TypeError("secret passenger detail");
    });
    const res = await route(request());
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("5");
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const text = await res.text();
    expect(text).not.toContain("passenger");
    expect(JSON.parse(text)).toEqual({
      error: "Something went wrong on our side. Please try again.",
      code: "unavailable",
    });
  });

  it("logs only the error name, never its message", async () => {
    const route = guardRoute("parse", async () => {
      throw new TypeError("note text Jane Roe");
    });
    await route(request());
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain("parse failed unexpectedly");
    expect(logged).toContain("TypeError");
    expect(logged).not.toContain("Jane");
  });

  it("answers a caller who has already gone with 499 and no failure", async () => {
    const controller = new AbortController();
    controller.abort();
    const route = guardRoute("test", async () => {
      throw new Error("aborted");
    });
    const res = await route(request(controller.signal));
    expect(res.status).toBe(499);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("handles a non-Error throw without leaking it", async () => {
    const route = guardRoute("test", async () => {
      throw "a string";
    });
    const res = await route(request());
    expect(res.status).toBe(503);
    expect(JSON.stringify(errorSpy.mock.calls)).toContain("unknown error");
  });
});
