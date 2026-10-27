/** @jest-environment node */
import { emptyTrip, trip } from "../e2e/fixtures";
import { missingFields, TripSchema } from "@/lib/trip";
import { makeTrip } from "./test-utils";

describe("shared test fixtures describe states the server can produce", () => {
  it.each([
    ["the browser tests' trip", trip],
    ["the browser tests' empty trip", emptyTrip],
  ])("%s is valid and its missing_fields is what the server computes", (_name, fixture) => {
    const parsed = TripSchema.parse(fixture);
    expect(parsed.missing_fields).toEqual(missingFields(parsed));
  });

  it("makeTrip always computes missing_fields from the data", () => {
    expect(makeTrip({ mobility: [], pickup_time: null }).missing_fields).toEqual([
      "pickup_time",
      "mobility",
    ]);
    expect(makeTrip({ missing_fields: ["wrong"] }).missing_fields).toEqual([]);
  });
});
