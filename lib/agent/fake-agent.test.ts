import type Anthropic from "@anthropic-ai/sdk";
import { fakeAgentModel } from "./fake-agent";
import type { ModelReply } from "./types";

const signal = new AbortController().signal;
const note = (trip: object) => `<note>\nE2E:${JSON.stringify(trip)}\n</note>`;
const trip = { passenger_name: "James O'Neil", pickup_date: "2026-11-20", pickup_time: "09:00" };

const first = (reply: ModelReply) => reply.content[0] as { name: string; input: unknown };
const toolResult = (content: string): Anthropic.MessageParam[] => [
  { role: "user", content: note(trip) },
  {
    role: "assistant",
    content: [
      { type: "tool_use", id: "t1", name: "find_rider", input: { name: "x" } },
    ] as Anthropic.ToolUseBlock[],
  },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content }] },
];

describe("fakeAgentModel", () => {
  it("searches for the passenger first", async () => {
    const reply = await fakeAgentModel()({
      messages: [{ role: "user", content: note(trip) }],
      signal,
    });
    expect(first(reply)).toMatchObject({ name: "find_rider", input: { name: "James O'Neil" } });
  });

  it("proposes when exactly one rider matches", async () => {
    const found = JSON.stringify({
      riders: [{ id: "r3", name: "James O'Neil", home: "7 Harbor Rd" }],
    });
    const reply = await fakeAgentModel()({ messages: toolResult(found), signal });
    expect(first(reply)).toMatchObject({
      name: "propose_trip",
      input: { rider_id: "r3", pickup_date: "2026-11-20", pickup_time: "09:00", reasons: [] },
    });
  });

  it("asks which rider when several match", async () => {
    const found = JSON.stringify({
      riders: [
        { id: "r1", name: "María López", home: "12 Elm St" },
        { id: "r2", name: "Maria Santos", home: "48 Birch Ave" },
      ],
    });
    const reply = await fakeAgentModel()({ messages: toolResult(found), signal });
    expect(first(reply).name).toBe("ask_dispatcher");
    expect(first(reply).input).toMatchObject({
      options: [
        { label: "María López, 12 Elm St", rider_id: "r1" },
        { label: "Maria Santos, 48 Birch Ave", rider_id: "r2" },
      ],
    });
  });

  it("asks when no rider matches", async () => {
    const reply = await fakeAgentModel()({
      messages: toolResult(JSON.stringify({ riders: [] })),
      signal,
    });
    expect(first(reply).name).toBe("ask_dispatcher");
  });

  it("asks for a name or a date when the note has neither", async () => {
    const noName = await fakeAgentModel()({
      messages: [{ role: "user", content: note({ ...trip, passenger_name: null }) }],
      signal,
    });
    expect(first(noName).name).toBe("ask_dispatcher");
    const noDate = await fakeAgentModel()({
      messages: [{ role: "user", content: note({ ...trip, pickup_date: null }) }],
      signal,
    });
    expect(first(noDate).name).toBe("ask_dispatcher");
  });

  it("proposes the chosen rider on resume, from the signed answer", async () => {
    const resumed = `<note>\nThe dispatcher answered "Which?" with "Maria". Rider id: r1. Pickup date 2026-11-20, pickup time 09:00. Propose.\n</note>`;
    const reply = await fakeAgentModel()({
      messages: [{ role: "user", content: resumed }],
      signal,
    });
    expect(first(reply)).toMatchObject({ name: "propose_trip", input: { rider_id: "r1" } });
  });

  it("asks again on resume when no rider or no date was chosen", async () => {
    const noRider = `<note>\nThe dispatcher answered "x" with "y". No rider id was chosen. Pickup date 2026-11-20, pickup time 09:00.\n</note>`;
    expect(
      first(await fakeAgentModel()({ messages: [{ role: "user", content: noRider }], signal }))
        .name,
    ).toBe("ask_dispatcher");
    const noDate = `<note>\nThe dispatcher answered "x" with "y". Rider id: r1. Pickup date unknown, pickup time unknown.\n</note>`;
    expect(
      first(await fakeAgentModel()({ messages: [{ role: "user", content: noDate }], signal })).name,
    ).toBe("ask_dispatcher");
  });

  it("refuses a note with no E2E trip", async () => {
    await expect(
      fakeAgentModel()({ messages: [{ role: "user", content: "<note>\nhello\n</note>" }], signal }),
    ).rejects.toThrow("no E2E: trip");
  });

  it("refuses an empty conversation", async () => {
    await expect(fakeAgentModel()({ messages: [], signal })).rejects.toThrow("no E2E: trip");
  });
});
