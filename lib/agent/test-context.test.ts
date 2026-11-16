/** @jest-environment node */
import { testContext } from "./test-context";

describe("testContext", () => {
  it("pins the clock to Monday Nov 2, 2026 in New York", () => {
    const ctx = testContext();
    expect(ctx.clock.now.toISOString()).toBe("2026-11-02T15:00:00.000Z");
    expect(ctx.clock.timeZone).toBe("America/New_York");
    expect(ctx.runId).toBe("run-1");
    expect(ctx.newId()).toBe("draft-1");
  });

  it("lets an override replace a field", () => {
    const ctx = testContext({ runId: "run-2" });
    expect(ctx.runId).toBe("run-2");
    expect(ctx.note).toBe("Maria to County Hospital tomorrow at 9am");
  });
});
