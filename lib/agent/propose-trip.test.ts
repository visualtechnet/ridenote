/** @jest-environment node */
import { makeTrip } from "../../tests/test-utils";
import { TOOL_ERRORS } from "./errors";
import { proposeTrip, proposeTripDef, ProposeTripInput, type DraftPayload } from "./propose-trip";
import { checkVehicleDef } from "./check-vehicle";
import { verify } from "./sign";
import { testContext } from "./test-context";

const defaultCtx = () =>
  testContext({ parsed: makeTrip({ pickup_location: "usual place", mobility: [] }) });

const propose = (over = {}, ctx = defaultCtx()) =>
  proposeTrip(
    {
      rider_id: "r1",
      pickup_date: "2026-11-03",
      pickup_time: "09:00",
      reasons: ["One rider matched."],
      ...over,
    },
    ctx,
  );

describe("proposeTrip", () => {
  it("ends the run with a signed draft", () => {
    const ctx = defaultCtx();
    const ok = propose({}, ctx);
    expect(ok.content).toBe('{"draft_id":"draft-1"}');
    expect(ok.end).toMatchObject({ status: "proposed", draftId: "draft-1" });
    if (ok.end?.status !== "proposed") throw new Error("expected a proposed end");
    const verified = verify<DraftPayload>(ok.end.draft, ctx.secret, ctx.clock.now, "draft");
    expect(verified).toMatchObject({
      ok: true,
      payload: {
        v: 1,
        draft_id: "draft-1",
        run_id: "run-1",
        trip: {
          passenger_name: "María López",
          pickup_location: "12 Elm St",
          pickup_date: "2026-11-03",
          pickup_time: "09:00",
          mobility: ["wheelchair"],
        },
        sources: { pickup: "rider_file", mobility: "rider_file" },
        conflicts: [],
      },
    });
    if (!verified.ok) throw new Error("expected a verified draft");
    expect(verified.payload.exp).toBe(ctx.clock.now.getTime() + 900_000);
  });

  it("fails verification when a byte changes", () => {
    const ctx = defaultCtx();
    const ok = propose({}, ctx);
    if (ok.end?.status !== "proposed") throw new Error("expected a proposed end");
    expect(
      verify(
        ok.end.draft.replace(/.$/, (c) => (c === "A" ? "B" : "A")),
        ctx.secret,
        ctx.clock.now,
        "draft",
      ).ok,
    ).toBe(false);
  });

  it("keeps a mobility conflict and marks it", () => {
    const end = propose({}, testContext({ parsed: makeTrip({ mobility: ["walker"] }) })).end;
    if (end?.status !== "proposed") throw new Error("expected a proposed end");
    expect(end.merged.conflicts).toEqual(["mobility"]);
  });

  it("returns an error result for an unknown rider", () => {
    const r = propose({ rider_id: "r9" });
    expect(r).toEqual({ content: TOOL_ERRORS.unknownRider("r9"), is_error: true });
    expect(r.end).toBeUndefined();
  });

  it("returns an error result for a date in the past", () => {
    expect(propose({ pickup_date: "2026-11-01" }).is_error).toBe(true);
  });

  it("returns an error result when the note gives no drop-off", () => {
    expect(propose({}, testContext({ parsed: makeTrip({ dropoff_location: null }) }))).toEqual({
      content: TOOL_ERRORS.dropoffMissing,
      is_error: true,
    });
  });

  it("returns an error result when mobility is unknown", () => {
    expect(
      propose({ rider_id: "r5" }, testContext({ parsed: makeTrip({ mobility: [] }) })),
    ).toEqual({ content: TOOL_ERRORS.mobilityUnknown, is_error: true });
  });

  it("returns an error result when mobility is only other", () => {
    const r = propose({}, testContext({ parsed: makeTrip({ mobility: ["other"] }) }));
    expect(r).toEqual({ content: TOOL_ERRORS.mobilityUnknown, is_error: true });
    expect(r.end).toBeUndefined();
  });

  it("returns an error result for a trip that fails TripSchema", () => {
    const r = propose({}, testContext({ parsed: makeTrip({ pickup_location: "x".repeat(301) }) }));
    expect(r.is_error).toBe(true);
    expect(r.content).toMatch(/^Invalid input for propose_trip: /);
    expect(r.end).toBeUndefined();
  });

  it("has no store to write to", () => {
    expect(Object.keys(testContext())).toEqual([
      "clock",
      "note",
      "parsed",
      "riders",
      "secret",
      "runId",
      "newId",
    ]);
  });
});

describe("ProposeTripInput", () => {
  const valid = {
    rider_id: "r1",
    pickup_date: "2026-11-03",
    pickup_time: "09:00",
    reasons: ["One rider matched."],
  };

  it("accepts a valid input", () => {
    expect(ProposeTripInput.safeParse(valid).success).toBe(true);
  });

  it("rejects a bad time, too many reasons and extra keys", () => {
    expect(ProposeTripInput.safeParse({ ...valid, pickup_time: "9:00" }).success).toBe(false);
    expect(ProposeTripInput.safeParse({ ...valid, reasons: Array(6).fill("a") }).success).toBe(
      false,
    );
    expect(ProposeTripInput.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});

describe("tool definitions", () => {
  it.each([checkVehicleDef, proposeTripDef])("a strict definition", (def) => {
    expect(def.strict).toBe(true);
    expect(def.input_schema.additionalProperties).toBe(false);
  });
});
