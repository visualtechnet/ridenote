/** @jest-environment node */
import { MOBILITY } from "./config";
import { formatDate, formatTime12h, mobilityLabel } from "./format";

describe("formatTime12h", () => {
  it.each([
    ["09:30", "9:30 AM"],
    ["07:00", "7:00 AM"],
    ["00:00", "12:00 AM"],
    ["00:05", "12:05 AM"],
    ["11:59", "11:59 AM"],
    ["12:00", "12:00 PM"],
    ["12:30", "12:30 PM"],
    ["13:05", "1:05 PM"],
    ["16:15", "4:15 PM"],
    ["23:59", "11:59 PM"],
  ])("%s becomes %s", (input, expected) => {
    expect(formatTime12h(input)).toBe(expected);
  });

  it("returns text it does not recognise unchanged, so nothing is ever hidden", () => {
    for (const odd of ["9:30pm", "25:00", "noon", "", "09:60"]) {
      expect(formatTime12h(odd)).toBe(odd);
    }
  });
});

describe("formatDate", () => {
  it.each([
    ["2026-11-06", "Fri, Nov 6, 2026"],
    ["2026-11-02", "Mon, Nov 2, 2026"],
    ["2027-01-01", "Fri, Jan 1, 2027"],
    ["2024-02-29", "Thu, Feb 29, 2024"],
  ])("%s becomes %s, whatever zone the reader is in", (input, expected) => {
    expect(formatDate(input)).toBe(expected);
  });

  it("returns text it does not recognise unchanged, so nothing is ever hidden", () => {
    for (const odd of ["tomorrow", "11/06/2026", "", "2026-13-45", "2026-02-30"]) {
      expect(formatDate(odd)).toBe(odd);
    }
  });
});

describe("mobilityLabel", () => {
  it("gives every aid in the vocabulary a readable label", () => {
    for (const aid of MOBILITY) {
      const label = mobilityLabel(aid);
      expect(label).toMatch(/^[A-Z]/);
      expect(label).not.toContain("_");
    }
  });

  it("uses plain words", () => {
    expect(mobilityLabel("wheelchair")).toBe("Wheelchair");
    expect(mobilityLabel("ambulatory")).toBe("Walks unaided");
  });
});
