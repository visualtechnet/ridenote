/** @jest-environment node */
import { clientKey, UNKNOWN_CLIENT } from "./client-key";

const req = (headers: Record<string, string>) => new Request("http://x", { headers });

describe("clientKey", () => {
  it("uses the platform's real-ip header first", () => {
    expect(clientKey(req({ "x-real-ip": " 1.2.3.4 ", "x-forwarded-for": "9.9.9.9" }))).toBe(
      "1.2.3.4",
    );
  });

  it("takes the last forwarded hop, never the first the client wrote", () => {
    expect(clientKey(req({ "x-forwarded-for": "6.6.6.6, 5.5.5.5" }))).toBe("5.5.5.5");
  });

  it("shares one bucket when no address is known", () => {
    expect(clientKey(req({}))).toBe(UNKNOWN_CLIENT);
  });
});
