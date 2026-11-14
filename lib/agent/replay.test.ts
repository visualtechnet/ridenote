/** @jest-environment node */
import { makeTrip } from "../../tests/test-utils";
import { runAgent } from "./loop";
import { replayRun } from "./replay";
import { testContext } from "./test-context";
import { scriptedModel, toolReply } from "./test-model";
import type { StepRecord } from "./types";

const find = { name: "find_rider", input: { name: "Nguyen" } };
const check = {
  name: "check_vehicle_availability",
  input: { date: "2026-11-03", time: "09:00", rider_id: "r4" },
};
const propose = {
  name: "propose_trip",
  input: {
    rider_id: "r4",
    pickup_date: "2026-11-03",
    pickup_time: "09:00",
    reasons: ["One match."],
  },
};

async function recorded(): Promise<StepRecord[]> {
  const model = scriptedModel([toolReply([find]), toolReply([check]), toolReply([propose])]);
  const r = await runAgent({ model, ctx: testContext() });
  return r.steps;
}

describe("replayRun", () => {
  it("replays a recorded run with no mismatches", async () => {
    const steps = await recorded();
    expect(replayRun(steps, testContext())).toEqual({ ok: true, mismatches: [] });
  });

  it("reports one mismatch for an edited result, with its step and call", async () => {
    const steps = structuredClone(await recorded());
    steps[1].calls[0].content = "edited";
    const r = replayRun(steps, testContext());
    expect(r.ok).toBe(false);
    expect(r.mismatches).toEqual([
      { step: 2, call: 0, recorded: "edited", replayed: (await recorded())[1].calls[0].content },
    ]);
  });

  it("reports a mismatch where a different parsed trip changes the result", async () => {
    const steps = await recorded();
    const ctx = testContext({ parsed: makeTrip({ mobility: ["walker"] }) });
    const r = replayRun(steps, ctx);
    expect(r.ok).toBe(false);
    expect(r.mismatches.map((m) => [m.step, m.call])).toEqual([[2, 0]]);
  });

  it("is ok for an empty list", () => {
    expect(replayRun([], testContext())).toEqual({ ok: true, mismatches: [] });
  });
});
