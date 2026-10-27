/** @jest-environment node */
import { isOutOfCredit } from "./upstream-errors";

const apiError = (status: number, message: string, type?: string) =>
  Object.assign(new Error(message), { status, type });

describe("isOutOfCredit", () => {
  it.each([
    [
      "a prepaid balance that ran out",
      apiError(
        400,
        "Your credit balance is too low to access the Anthropic API.",
        "invalid_request_error",
      ),
    ],
    [
      "a workspace spend limit",
      apiError(
        400,
        "You have reached your specified workspace API usage limits.",
        "invalid_request_error",
      ),
    ],
    ["a billing error", apiError(402, "There is an issue with your billing.", "billing_error")],
    ["a billing type on any status", apiError(400, "x", "billing_error")],
  ])("recognises %s", (_name, err) => {
    expect(isOutOfCredit(err)).toBe(true);
  });

  it.each([
    ["a bad key", apiError(401, "invalid x-api-key", "authentication_error")],
    ["a rate limit", apiError(429, "Rate limit reached", "rate_limit_error")],
    ["an ordinary bad request", apiError(400, "messages: field required", "invalid_request_error")],
    ["the note echoed back with the word balance", apiError(400, "Mrs. Lee balance", undefined)],
    ["a plain error that mentions credit", new Error("400 credit balance is too low")],
    ["a string", "credit balance is too low"],
    ["null", null],
    ["undefined", undefined],
  ])("does not mistake %s for it", (_name, err) => {
    expect(isOutOfCredit(err)).toBe(false);
  });
});
