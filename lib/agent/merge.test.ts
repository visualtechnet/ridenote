/** @jest-environment node */
import { makeTrip } from "../../tests/test-utils";
import { TripSchema } from "../trip";
import { mergedMobility, mergeTrip, usesHomePickup } from "./merge";
import { RIDERS } from "./riders";

const r1 = RIDERS[0];
const r5 = RIDERS[4];
const when = { pickup_date: "2026-11-03", pickup_time: "09:00" };

describe("mergeTrip", () => {
  it("takes the name from the rider file", () => {
    expect(mergeTrip(makeTrip({ passenger_name: "maria" }), r1, when).trip.passenger_name).toBe(
      "María López",
    );
  });

  it.each([null, "home", "Home", " usual place ", "the usual", "her home", "their house"])(
    "pickup %j uses the rider's home",
    (pickup) => {
      const m = mergeTrip(makeTrip({ pickup_location: pickup }), r1, when);
      expect(m.trip.pickup_location).toBe("12 Elm St");
      expect(m.sources.pickup).toBe("rider_file");
    },
  );

  it.each(["County Hospital", "Home Depot on Main St", "nursing home on 5th"])(
    "pickup %j stays the note's",
    (pickup) => {
      const m = mergeTrip(makeTrip({ pickup_location: pickup }), r1, when);
      expect(m.trip.pickup_location).toBe(pickup);
      expect(m.sources.pickup).toBe("note");
    },
  );

  it("never takes the drop-off from the file", () => {
    expect(
      mergeTrip(makeTrip({ dropoff_location: null }), r1, when).trip.dropoff_location,
    ).toBeNull();
  });

  it("takes the date and time from the checked values", () => {
    const m = mergeTrip(makeTrip({ pickup_date: null, pickup_time: "14:00" }), r1, when);
    expect(m.trip.pickup_date).toBe(when.pickup_date);
    expect(m.trip.pickup_time).toBe(when.pickup_time);
  });

  it("keeps the note's notes unchanged", () => {
    expect(mergeTrip(makeTrip({ notes: "Ring twice." }), r1, when).trip.notes).toBe("Ring twice.");
  });

  it("recomputes missing_fields", () => {
    expect(
      mergeTrip(makeTrip({ mobility: [], missing_fields: ["mobility"] }), r1, when).trip
        .missing_fields,
    ).toEqual([]);
  });

  it("reports mobility sources and conflicts", () => {
    const m = mergeTrip(makeTrip({ mobility: ["walker"] }), r1, when);
    expect(m.sources.mobility).toBe("note");
    expect(m.conflicts).toEqual(["mobility"]);
    const filled = mergeTrip(makeTrip({ mobility: [] }), r1, when);
    expect(filled.sources.mobility).toBe("rider_file");
    expect(filled.conflicts).toEqual([]);
  });

  it("produces a trip that passes TripSchema", () => {
    expect(TripSchema.safeParse(mergeTrip(makeTrip(), r1, when).trip).success).toBe(true);
  });
});

describe("mergedMobility", () => {
  it("lets the note win and flags a conflict", () => {
    expect(mergedMobility(makeTrip({ mobility: ["walker"] }), r1)).toEqual({
      mobility: ["walker"],
      source: "note",
      conflict: true,
    });
  });
  it("fills from the rider file when the note names none", () => {
    expect(mergedMobility(makeTrip({ mobility: [] }), r1)).toEqual({
      mobility: ["wheelchair"],
      source: "rider_file",
      conflict: false,
    });
  });
  it("is empty with source none when neither names any", () => {
    expect(mergedMobility(makeTrip({ mobility: [] }), r5)).toEqual({
      mobility: [],
      source: "none",
      conflict: false,
    });
  });
  it("is no conflict when the note agrees with the file", () => {
    expect(mergedMobility(makeTrip({ mobility: ["wheelchair"] }), r1).conflict).toBe(false);
  });
  it("treats the same set in another order as no conflict", () => {
    const rider = {
      ...r1,
      mobility_on_file: ["walker", "wheelchair"] as typeof r1.mobility_on_file,
    };
    expect(mergedMobility(makeTrip({ mobility: ["wheelchair", "walker"] }), rider).conflict).toBe(
      false,
    );
  });
  it("is a conflict when the sets differ in size", () => {
    const rider = {
      ...r1,
      mobility_on_file: ["walker", "wheelchair"] as typeof r1.mobility_on_file,
    };
    expect(mergedMobility(makeTrip({ mobility: ["wheelchair"] }), rider).conflict).toBe(true);
  });
});

describe("usesHomePickup", () => {
  it("is true for null and false for a named place", () => {
    expect(usesHomePickup(null)).toBe(true);
    expect(usesHomePickup("County Hospital")).toBe(false);
  });

  it.each([
    "María's usual place",
    "Maria Lopez's home",
    "López's house",
    "maría lópez’s usual pickup",
    "Lopez's usual spot",
  ])("treats %j as the rider's own home when it names the rider", (pickup) => {
    expect(usesHomePickup(pickup, "María López")).toBe(true);
  });

  it.each([
    "her sister's house",
    "Maria's brother's home",
    "Dorothy's usual place",
    "Maria's office",
    "Maria's home depot",
  ])("does not treat %j as the rider's home", (pickup) => {
    expect(usesHomePickup(pickup, "María López")).toBe(false);
  });

  it("does not match a possessive when no rider name is given", () => {
    expect(usesHomePickup("Maria's home")).toBe(false);
    expect(usesHomePickup("her home")).toBe(true);
  });

  it("matches a name with an apostrophe", () => {
    expect(usesHomePickup("James O'Neil's home", "James O'Neil")).toBe(true);
    expect(usesHomePickup("O'Neil's usual place", "James O'Neil")).toBe(true);
  });

  it("uses the rider's address when the note says the rider's name and usual place", () => {
    const m = mergeTrip(makeTrip({ pickup_location: "María López's usual place" }), r1, when);
    expect(m.trip.pickup_location).toBe("12 Elm St");
    expect(m.sources.pickup).toBe("rider_file");
  });

  it("keeps someone else's home as the note wrote it", () => {
    const m = mergeTrip(makeTrip({ pickup_location: "her sister's house" }), r1, when);
    expect(m.trip.pickup_location).toBe("her sister's house");
    expect(m.sources.pickup).toBe("note");
  });
});
