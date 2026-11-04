/** @jest-environment node */
import { tripToText } from "./trip-text";
import type { Trip } from "./trip";

const full: Trip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
  pickup_date: "2026-11-06",
  pickup_time: "09:30",
  mobility: ["wheelchair", "cane"],
  missing_fields: [],
  notes: "Confirm ramp access.",
};

describe("tripToText", () => {
  it("writes one labelled line per field, in the order a dispatcher reads them, then the note", () => {
    expect(tripToText(full)).toBe(
      [
        "Passenger: Mrs. Lee",
        "Pickup date: Fri, Nov 6, 2026",
        "Pickup time: 9:30 AM",
        "Pickup: 12 Oak St",
        "Dropoff: County Hospital",
        "Mobility: Wheelchair, Cane",
        "Parser note: Confirm ramp access.",
      ].join("\n"),
    );
  });

  it("writes every blank as 'Not stated' rather than leaving the line out", () => {
    const text = tripToText({
      ...full,
      passenger_name: null,
      pickup_location: null,
      dropoff_location: null,
      pickup_date: null,
      pickup_time: null,
      mobility: [],
      notes: "",
    });
    expect(text.split("\n")).toEqual([
      "Passenger: Not stated",
      "Pickup date: Not stated",
      "Pickup time: Not stated",
      "Pickup: Not stated",
      "Dropoff: Not stated",
      "Mobility: Not stated",
    ]);
  });

  it("puts the reason for a cleared date beside the date, and keeps the rest of the note apart", () => {
    const reason = "Date Thu, Oct 1, 2026 has already passed; confirm the date.";
    const text = tripToText({ ...full, pickup_date: null, notes: `${reason} Approximate time.` });
    expect(text).toContain(`Pickup date: Not stated (${reason})`);
    expect(text).toContain("Parser note: Approximate time.");
  });

  it("copies model output as text, so markup stays markup", () => {
    const evil = '<img src=x onerror="alert(1)">';
    expect(tripToText({ ...full, pickup_location: evil })).toContain(`Pickup: ${evil}`);
  });
});
