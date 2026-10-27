import { MESSAGES } from "./messages";

describe("MESSAGES", () => {
  it("says 'second' for one second and 'seconds' otherwise", () => {
    expect(MESSAGES.tooManyRequestsIn(1)).toContain("1 second ");
    expect(MESSAGES.tooManyRequestsIn(2)).toContain("2 seconds ");
  });

  it("formats the length in the too-long message with separators", () => {
    expect(MESSAGES.noteTooLong(12345)).toContain("12,345");
  });
});
