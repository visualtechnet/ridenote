/** @jest-environment node */
import { REMOVED, scrubText } from "./scrub";

describe("scrubText", () => {
  it.each([
    // emails
    ["Lee lee@x.org", `Lee ${REMOVED}`],
    // phones
    ["555-123-4567", REMOVED],
    ["(555) 123-4567", REMOVED],
    ["555.123.4567", REMOVED],
    ["+1 555 123 4567", REMOVED],
    ["+44 20 7946 0958", REMOVED],
    // identifier-like digit runs
    ["123-45-6789", REMOVED],
    ["4111 1111 1111 1111", REMOVED],
    // labelled values
    ["DOB 03/14/1950", REMOVED],
    ["Medicaid ID A12345", REMOVED],
    ["policy #889921", REMOVED],
    ["ID: 83702", REMOVED],
    ["ID #A12345", REMOVED],
    // links
    ["https://evil.example/x", REMOVED],
    ["www.x.com", REMOVED],
  ])("removes %j", (input, expected) => {
    expect(scrubText(input)).toBe(expected);
  });

  it.each([
    "12 Oak St",
    "4500 Elm Ave Apt 4B",
    "County Hospital, 90210",
    "Suite 300",
    "09:30",
    "Mrs. Lee",
    "Boise, ID 83702",
    "Pick up at 123 Main St, ID 83702",
    "",
  ])("leaves %j alone", (input) => {
    expect(scrubText(input)).toBe(input);
  });

  it("keeps null as null", () => {
    expect(scrubText(null)).toBeNull();
  });
});
