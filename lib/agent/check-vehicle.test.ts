/** @jest-environment node */
import { makeTrip } from "../../tests/test-utils";
import { checkVehicle, checkVehicleDef } from "./check-vehicle";
import { TOOL_ERRORS } from "./errors";
import { testContext } from "./test-context";

const check = (over = {}, ctx = testContext()) =>
  checkVehicle({ date: "2026-11-03", time: "09:00", rider_id: "r1", ...over }, ctx);

describe("checkVehicle", () => {
  it("answers with the vehicle class, the same way every time", () => {
    expect(JSON.parse(check().content)).toEqual({
      available: true,
      vehicle_class: "wheelchair_van",
    });
    expect(check()).toEqual(check());
  });

  it("uses the rider's file only when the note is silent on mobility", () => {
    // makeTrip() names a wheelchair, and the note wins, so the file only decides when the note is silent
    const silent = testContext({ parsed: makeTrip({ pickup_date: "2026-11-03", mobility: [] }) });
    expect(JSON.parse(check({ rider_id: "r4" }, silent).content).vehicle_class).toBe(
      "stretcher_van",
    );
    expect(JSON.parse(check({ rider_id: "r4" }).content).vehicle_class).toBe("wheelchair_van");
  });

  it("lets the note's mobility win over the file", () => {
    expect(
      JSON.parse(
        check(
          {},
          testContext({ parsed: makeTrip({ pickup_date: "2026-11-03", mobility: ["cane"] }) }),
        ).content,
      ).vehicle_class,
    ).toBe("sedan");
  });

  it("returns an error for an unknown rider", () => {
    expect(check({ rider_id: "r9" })).toEqual({
      content: TOOL_ERRORS.unknownRider("r9"),
      is_error: true,
    });
  });

  it("returns an error when mobility is not known", () => {
    expect(
      check(
        { rider_id: "r5" },
        testContext({ parsed: makeTrip({ pickup_date: "2026-11-03", mobility: [] }) }),
      ),
    ).toEqual({
      content: TOOL_ERRORS.mobilityUnknown,
      is_error: true,
    });
  });

  it("returns an error on the day the fake service is down", () => {
    expect(check({ date: "2026-11-13" })).toEqual({
      content: TOOL_ERRORS.serviceDown,
      is_error: true,
    });
  });

  it("returns an error when the note gave no date", () => {
    const ctx = testContext({ parsed: makeTrip({ pickup_date: null }) });
    expect(check({}, ctx)).toEqual({ content: TOOL_ERRORS.dateNotStated, is_error: true });
  });

  it("returns an error for a date in the past", () => {
    expect(check({ date: "2026-11-01" }).is_error).toBe(true);
  });
});

describe("checkVehicleDef", () => {
  it("is a strict definition", () => {
    expect(checkVehicleDef.name).toBe("check_vehicle_availability");
    expect(checkVehicleDef.strict).toBe(true);
    expect(checkVehicleDef.input_schema.additionalProperties).toBe(false);
  });
});
