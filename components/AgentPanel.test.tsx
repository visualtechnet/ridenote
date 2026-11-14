import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TextDecoder, TextEncoder } from "util";
import { AgentPanel } from "./AgentPanel";
import type { MergedTrip, StreamEvent } from "@/lib/stream-events";
import type { Trip } from "@/lib/trip";

// jsdom has no text codecs; the browser has them, and the panel reads the stream with them.
Object.assign(global, { TextDecoder, TextEncoder });

const NOTE = "James O'Neil to County Hospital tomorrow at 9am";
const usage = { steps: 2, inputTokens: 300, outputTokens: 40, cacheRead: 0, latencyMs: 2500 };
const trip: Trip = {
  passenger_name: "James O'Neil",
  pickup_location: "7 Harbor Rd",
  dropoff_location: "County Hospital",
  pickup_date: "2026-11-20",
  pickup_time: "09:00",
  mobility: ["ambulatory"],
  missing_fields: [],
  notes: "",
};
const merged: MergedTrip = {
  trip,
  sources: { pickup: "note", mobility: "rider_file" },
  conflicts: [],
};

/** A reply whose body is the given lines, as the route streams them. */
function streamOf(lines: (object | string)[]) {
  const text = lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l)) + "\n").join("");
  const bytes = new TextEncoder().encode(text);
  let sent = false;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          if (sent) return { done: true, value: undefined };
          sent = true;
          return { done: false, value: bytes };
        },
      }),
    },
    json: async () => ({}),
  };
}

const jsonReply = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  body: null,
  json: async () => body,
});

function mockFetch(...replies: unknown[]) {
  const fetchMock = jest.fn();
  for (const reply of replies) fetchMock.mockResolvedValueOnce(reply);
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const run = (...events: StreamEvent[]) =>
  streamOf([{ type: "run_started", runId: "r1" }, ...events]);

const proposed: StreamEvent = {
  type: "ended",
  status: "proposed",
  draftId: "d1",
  draft: "signed",
  merged,
  usage,
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("AgentPanel", () => {
  it("cannot start a run until there is a valid note", () => {
    render(<AgentPanel note="" />);
    expect(screen.getByRole("button", { name: "Plan trip (agent)" })).toBeDisabled();
    expect(screen.getByText("Type a note above first.")).toBeInTheDocument();
  });

  it("shows each step, then the proposal with its badges, and saves on Approve", async () => {
    const fetchMock = mockFetch(
      run(
        { type: "parsed", trip },
        {
          type: "step",
          step: 1,
          stopReason: "tool_use",
          calls: [{ name: "find_rider", is_error: false, content: "{}" }],
          inputTokens: 100,
          outputTokens: 20,
          ms: 5,
        },
        proposed,
      ),
      jsonReply(200, { status: "saved", message: "Saved to History." }),
    );
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));

    expect(await screen.findByText("Step 1: Looked up a rider")).toBeInTheDocument();
    expect(screen.getByText("Read the note: James O'Neil.")).toBeInTheDocument();
    expect(screen.getByText("from note")).toBeInTheDocument();
    expect(screen.getByText("mobility from rider file")).toBeInTheDocument();
    expect(screen.getByText("2 steps, 340 tokens, 2.5 s.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Saved to History.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/agent/approve",
      expect.objectContaining({ body: JSON.stringify({ draft: "signed" }) }),
    );
  });

  it("shows the conflict badge when the note and the rider file disagree", async () => {
    mockFetch(run({ ...proposed, merged: { ...merged, conflicts: ["mobility"] } } as StreamEvent));
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    expect(await screen.findByText("conflict: mobility")).toBeInTheDocument();
  });

  it("shows the options for a question and resumes the run with the one chosen", async () => {
    const fetchMock = mockFetch(
      run({
        type: "ended",
        status: "needs_info",
        question: "Which Maria?",
        options: [
          { label: "María López, 12 Elm St", rider_id: "r1" },
          { label: "Maria Santos, 48 Birch Ave", rider_id: "r2" },
        ],
        resume: "token-1",
        usage,
      }),
      run(proposed),
    );
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Maria Santos, 48 Birch Ave" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      resume: { token: "token-1", choice: 1 },
    });
    expect(await screen.findByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("explains a failed run and offers no Approve", async () => {
    mockFetch(run({ type: "ended", status: "failed", reason: "deadline", usage }));
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    expect(await screen.findByText(/It ran out of time/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("names a failure that needs no words for each reason, and a missing one plainly", async () => {
    mockFetch(run({ type: "ended", status: "failed", reason: "aborted", usage }));
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    expect(await screen.findByText(/The run was stopped/)).toBeInTheDocument();
  });

  it("shows the server's message when the run cannot start", async () => {
    mockFetch(jsonReply(503, { error: "Agent unavailable" }));
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Agent unavailable");
  });

  it("says a line could not be read, and keeps going", async () => {
    mockFetch(streamOf([{ type: "run_started", runId: "r1" }, "not json", proposed]));
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    expect(
      await screen.findByText("Part of the agent's answer could not be read."),
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("says the connection dropped when the request fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    expect(await screen.findByText("The connection dropped. Try again.")).toBeInTheDocument();
  });

  it("shows a plain error when Approve is refused", async () => {
    mockFetch(run(proposed), jsonReply(400, { error: "That draft has expired or is not valid." }));
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("That draft has expired or is not valid.")).toBeInTheDocument();
  });

  it("shows a plain error when Approve cannot reach the server", async () => {
    mockFetch(run(proposed));
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(streamOf([{ type: "run_started", runId: "r1" }, proposed]))
      .mockRejectedValueOnce(new Error("offline")) as unknown as typeof fetch;
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Could not save. Try again.")).toBeInTheDocument();
  });

  it("uses a plain message when Approve gets no readable answer", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(streamOf([{ type: "run_started", runId: "r1" }, proposed]))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("x");
        },
      }) as unknown as typeof fetch;
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Could not save.")).toBeInTheDocument();
  });

  it("shows the timeline for a parse failure and a failed run", async () => {
    mockFetch(
      run(
        { type: "error", code: "parse_failed" },
        { type: "ended", status: "failed", reason: "upstream", usage },
      ),
    );
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    expect(await screen.findByText("The agent stopped early.")).toBeInTheDocument();
    expect(await screen.findByText(/The model did not answer in time/)).toBeInTheDocument();
  });

  it("says when a step made no tool call and when a tool did not work", async () => {
    mockFetch(
      run(
        {
          type: "step",
          step: 1,
          stopReason: "end_turn",
          calls: [],
          inputTokens: 1,
          outputTokens: 1,
          ms: 1,
        },
        {
          type: "step",
          step: 2,
          stopReason: "tool_use",
          calls: [{ name: "find_rider", is_error: true, content: "No rider matches." }],
          inputTokens: 1,
          outputTokens: 1,
          ms: 1,
        },
        {
          type: "step",
          step: 3,
          stopReason: "tool_use",
          calls: [{ name: "mystery_tool", is_error: false, content: "" }],
          inputTokens: 1,
          outputTokens: 1,
          ms: 1,
        },
      ),
    );
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    expect(await screen.findByText("Step 1: no tool was used.")).toBeInTheDocument();
    expect(
      screen.getByText("Step 2: Looked up a rider (did not work: No rider matches.)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 3: mystery_tool")).toBeInTheDocument();
  });

  it("uses the singular for one step", async () => {
    mockFetch(run({ ...proposed, usage: { ...usage, steps: 1 } } as StreamEvent));
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    expect(await screen.findByText("1 step, 340 tokens, 2.5 s.")).toBeInTheDocument();
  });

  it("shows the question and options for an answer that asked nothing", async () => {
    mockFetch(
      run({
        type: "ended",
        status: "needs_info",
        question: "Which?",
        options: [{ label: "Pick a rider", rider_id: null }],
        resume: "t",
        usage,
      }),
    );
    render(<AgentPanel note={NOTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan trip (agent)" }));
    expect(await screen.findByText("Which?")).toBeInTheDocument();
  });
});
