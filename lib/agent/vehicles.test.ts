/** @jest-environment node */
import type { Trip } from "../trip";
import { vehicleClassFor, vehicleServiceDown } from "./vehicles";

describe("vehicleClassFor", () => {
  it.each([
    [["wheelchair"], "wheelchair_van"],
    [["scooter"], "wheelchair_van"],
    [["stretcher"], "stretcher_van"],
    [["walker"], "sedan"],
    [["cane"], "sedan"],
    [["crutches"], "sedan"],
    [["ambulatory"], "sedan"],
    [["walker", "wheelchair"], "wheelchair_van"],
    [["wheelchair", "stretcher"], "stretcher_van"],
    [["other"], null],
    [["wheelchair", "other"], null],
    [[], null],
  ] as [Trip["mobility"], string | null][])("mobility %j needs %s", (mobility, expected) =>
    expect(vehicleClassFor(mobility)).toBe(expected),
  );
});

describe("vehicleServiceDown", () => {
  it("is down on the 13th of any month", () => {
    expect(vehicleServiceDown("2026-11-13")).toBe(true);
    expect(vehicleServiceDown("2026-12-13")).toBe(true);
  });
  it("is up on other days", () => {
    expect(vehicleServiceDown("2026-11-14")).toBe(false);
  });
});
