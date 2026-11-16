/** @jest-environment node */
import { classifyUpstreamFailure } from "./upstream-failure";

const apiError = (status: number, message: string, type?: string) =>
  Object.assign(new Error(message), { status, type });

describe("classifyUpstreamFailure", () => {
  it("recognises an out-of-credit answer first, whatever its status", () => {
    expect(
      classifyUpstreamFailure(
        apiError(400, "Your credit balance is too low", "invalid_request_error"),
      ),
    ).toBe("out_of_credit");
  });

  it.each([
    ["a rate limit", apiError(429, "Rate limit reached", "rate_limit_error")],
    ["an overloaded provider", apiError(529, "Overloaded", "overloaded_error")],
    ["a provider 500", apiError(500, "Internal error", "api_error")],
    ["a provider 503", apiError(503, "Service unavailable", "api_error")],
  ])("answers %s as busy, so the person is asked to try later", (_name, err) => {
    expect(classifyUpstreamFailure(err)).toBe("busy");
  });

  it.each([
    ["a rejected key", apiError(401, "invalid x-api-key", "authentication_error")],
    ["a forbidden key", apiError(403, "permission denied", "permission_error")],
  ])("answers %s as misconfigured, not as the person's fault", (_name, err) => {
    expect(classifyUpstreamFailure(err)).toBe("misconfigured");
  });

  it.each([
    ["an ordinary bad request", apiError(400, "messages: field required", "invalid_request_error")],
    ["a network failure with no status", new Error("socket hang up")],
    ["a non-object", "boom"],
    ["null", null],
  ])("answers %s as a plain failure", (_name, err) => {
    expect(classifyUpstreamFailure(err)).toBe("failed");
  });
});
