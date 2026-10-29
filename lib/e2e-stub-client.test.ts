import { createStubClient, stubActive } from "./e2e-stub-client";
import { wrapNote } from "./prompt";

describe("stubActive", () => {
  it("is never active on a production build, even with the switch on", () => {
    expect(stubActive({ NODE_ENV: "production", E2E_STUB_PARSE: "1" })).toBe(false);
  });
  it("is off without the switch", () => {
    expect(stubActive({ NODE_ENV: "development" })).toBe(false);
    expect(stubActive({ NODE_ENV: "test" })).toBe(false);
    expect(stubActive({})).toBe(false);
  });
  it("is off for any switch value but 1", () => {
    expect(stubActive({ NODE_ENV: "development", E2E_STUB_PARSE: "true" })).toBe(false);
    expect(stubActive({ NODE_ENV: "development", E2E_STUB_PARSE: "" })).toBe(false);
  });
  it("is on only for development or test with the switch", () => {
    expect(stubActive({ NODE_ENV: "development", E2E_STUB_PARSE: "1" })).toBe(true);
    expect(stubActive({ NODE_ENV: "test", E2E_STUB_PARSE: "1" })).toBe(true);
  });
  it("is off when NODE_ENV is unset, so a missing value never enables it", () => {
    expect(stubActive({ E2E_STUB_PARSE: "1" })).toBe(false);
  });
});

describe("createStubClient", () => {
  const parse = (content: string) =>
    createStubClient().messages.create({
      model: "m",
      max_tokens: 1,
      messages: [{ role: "user", content }],
    });

  it("returns the JSON after the E2E: prefix as the reply text", async () => {
    const trip = { passenger_name: "Mrs. Lee", mobility: [] };
    const res = await parse(wrapNote(`E2E:${JSON.stringify(trip)}`));
    expect(res.stop_reason).toBe("end_turn");
    expect(JSON.parse((res.content[0] as { text: string }).text)).toEqual(trip);
  });

  it("throws for a note without the prefix, so it can never pass for a real parse", async () => {
    await expect(parse(wrapNote("Pick up Mrs. Lee at 9"))).rejects.toThrow();
  });

  it("throws for invalid JSON after the prefix", async () => {
    await expect(parse(wrapNote("E2E:{nope"))).rejects.toThrow();
  });
});

describe("stubActive on a production build", () => {
  const original = process.env.NODE_ENV;
  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: original });
  });

  it("is off when the real process.env says production, whatever env is passed", () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    expect(stubActive({ NODE_ENV: "test", E2E_STUB_PARSE: "1" })).toBe(false);
  });
});
