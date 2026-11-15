import { runAgent } from "./loop";
import { scriptedModel, toolReply } from "./test-model";
import { testContext } from "./test-context";

const proposal = {
  rider_id: "r1",
  pickup_date: "2026-11-03",
  pickup_time: "09:00",
  reasons: [],
};

describe("runAgent with known rider ids", () => {
  it("accepts a rider id that was known before the run, without a search", async () => {
    const result = await runAgent({
      model: scriptedModel([toolReply([{ name: "propose_trip", input: proposal }])]),
      ctx: testContext({ note: "Maria to County Hospital tomorrow at 9am" }),
      knownRiderIds: ["r1"],
    });
    expect(result.status).toBe("proposed");
  });

  it("still refuses a rider id that was neither known nor searched", async () => {
    const result = await runAgent({
      model: scriptedModel([
        toolReply([{ name: "propose_trip", input: proposal }]),
        toolReply([{ name: "propose_trip", input: proposal }]),
        toolReply([{ name: "propose_trip", input: proposal }]),
        toolReply([{ name: "propose_trip", input: proposal }]),
      ]),
      ctx: testContext({ note: "Maria to County Hospital tomorrow at 9am" }),
    });
    expect(result.status).toBe("failed");
  });
});
