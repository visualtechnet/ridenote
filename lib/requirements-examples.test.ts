/** @jest-environment node */
import { OUTPUT_EXAMPLES } from "./requirements-examples";
import { missingFields, TripSchema } from "./trip";

describe("requirements page examples", () => {
  it.each(OUTPUT_EXAMPLES.map((e) => [e.title, e.trip]))("%s matches TripSchema", (_t, trip) => {
    expect(TripSchema.safeParse(trip).success).toBe(true);
  });

  it.each(OUTPUT_EXAMPLES.map((e) => [e.title, e.trip]))(
    "%s reports missing_fields exactly as the server computes them",
    (_t, trip) => {
      expect((trip as (typeof OUTPUT_EXAMPLES)[number]["trip"]).missing_fields).toEqual(
        missingFields(trip as (typeof OUTPUT_EXAMPLES)[number]["trip"]),
      );
    },
  );

  it("round-trips through JSON unchanged", () => {
    for (const { trip } of OUTPUT_EXAMPLES) expect(JSON.parse(JSON.stringify(trip))).toEqual(trip);
  });
});
