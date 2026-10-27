import { createPostgresStore, neonQuery, type QueryFn } from "./history-postgres";
import type { HistoryRecord } from "./history";

const record: HistoryRecord = {
  passenger_name: "Ann",
  pickup_location: "1 Main St",
  dropoff_location: "Clinic",
  pickup_time: "09:30",
  mobility: ["wheelchair"],
};

function fakeQuery(rows: unknown[]) {
  const calls: { text: string; params: unknown[] }[] = [];
  const query: QueryFn = async (text, params) => {
    calls.push({ text, params });
    return { rows };
  };
  return { query, calls };
}

describe("createPostgresStore.insert", () => {
  it("sends one conditional statement with the five values and the cap as parameters", async () => {
    const { query, calls } = fakeQuery([{ id: "1" }]);
    await createPostgresStore("postgres://unused", query).insert(record, 2000);
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toEqual(["Ann", "1 Main St", "Clinic", "09:30", ["wheelchair"], 2000]);
    expect(calls[0].text).toContain("now() - interval '1 day'");
    expect(calls[0].text).toMatch(/created_at > now\(\)/);
  });

  it("returns true when a row was inserted and false when the cap stopped it", async () => {
    expect(await createPostgresStore("u", fakeQuery([{ id: "1" }]).query).insert(record, 5)).toBe(
      true,
    );
    expect(await createPostgresStore("u", fakeQuery([]).query).insert(record, 5)).toBe(false);
  });
});

describe("createPostgresStore.list", () => {
  it("passes limit and sinceDays, and maps rows (inclusive cut-off, newest first)", async () => {
    const { query, calls } = fakeQuery([
      {
        id: "7",
        created_at: "2026-10-27T10:00:00.000Z",
        passenger_name: null,
        pickup_location: "A",
        dropoff_location: null,
        pickup_time: null,
        mobility: null,
      },
      {
        id: 6,
        created_at: new Date("2026-10-26T10:00:00.000Z"),
        passenger_name: "Bo",
        pickup_location: null,
        dropoff_location: null,
        pickup_time: "08:00",
        mobility: ["walker"],
      },
    ]);
    const rows = await createPostgresStore("u", query).list(200, 7);
    expect(calls[0].params).toEqual([200, 7]);
    expect(calls[0].text).toMatch(/created_at >= now\(\)/);
    expect(calls[0].text).toMatch(/ORDER BY created_at DESC/i);
    expect(rows[0]).toMatchObject({ id: 7, mobility: [], pickup_location: "A" });
    expect(rows[0].created_at).toEqual(new Date("2026-10-27T10:00:00.000Z"));
    expect(rows[1]).toMatchObject({ id: 6, mobility: ["walker"] });
    expect(rows[1].created_at).toEqual(new Date("2026-10-26T10:00:00.000Z"));
  });
});

describe("neonQuery", () => {
  it("wraps the Neon driver's parameterised query and returns { rows }", async () => {
    const driver = jest.fn().mockResolvedValue([{ a: 1 }]);
    const neon = jest.fn().mockReturnValue({ query: driver });
    jest.resetModules();
    jest.doMock("@neondatabase/serverless", () => ({ neon }));
    const { neonQuery: fresh } = await import("./history-postgres");
    const result = await fresh("postgres://fake")("select $1", [1]);
    expect(neon).toHaveBeenCalledWith("postgres://fake");
    expect(driver).toHaveBeenCalledWith("select $1", [1]);
    expect(result).toEqual({ rows: [{ a: 1 }] });
    jest.dontMock("@neondatabase/serverless");
  });

  it("opens nothing until a query runs", () => {
    expect(() => neonQuery("postgres://unused")).not.toThrow();
  });
});
