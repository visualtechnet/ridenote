"use client";

import { useState } from "react";
import { browserTimeZone } from "@/lib/api-client";
import type { AskOption, MergedTrip, StreamEvent } from "@/lib/stream-events";
import { validateNote } from "@/lib/validation";

type Ended = Extract<StreamEvent, { type: "ended" }>;
type Approval =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "done"; message: string }
  | { phase: "error"; message: string };

const TOOL_WORDS: Record<string, string> = {
  find_rider: "Looked up a rider",
  check_vehicle_availability: "Checked a vehicle",
  propose_trip: "Proposed a trip",
  ask_dispatcher: "Asked the dispatcher",
};

const REASON_WORDS: Record<string, string> = {
  step_cap: "It used all its steps before it finished.",
  token_budget: "It used up its token budget before it finished.",
  deadline: "It ran out of time before it finished.",
  upstream: "The model did not answer in time. Nothing was booked.",
  refused: "The model refused to continue.",
  cut_off: "The model's answer was cut off.",
  invalid_tool_input: "It kept making the same mistake, so it stopped.",
  no_tool_call: "The model did not use a tool.",
  aborted: "The run was stopped.",
};

const SOURCE_BADGE = { note: "from note", rider_file: "from rider file" } as const;

/** Lines the page could not read become one plain notice, never a crash. */
function parseLine(line: string): StreamEvent | { type: "bad" } {
  try {
    return JSON.parse(line) as StreamEvent;
  } catch {
    return { type: "bad" };
  }
}

/**
 * The agent panel: plans one trip from the note through a streamed run. Each step appears as it
 * happens. The only thing the panel can save is an approved draft, and only when a person presses
 * Approve.
 */
export function AgentPanel({ note }: { note: string }) {
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [ended, setEnded] = useState<Ended | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approval, setApproval] = useState<Approval>({ phase: "idle" });
  const valid = validateNote(note);

  async function stream(body: unknown) {
    setRunning(true);
    setError(null);
    setEnded(null);
    setApproval({ phase: "idle" });
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "The agent could not start. Try again.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim() === "") continue;
          const event = parseLine(line);
          if (event.type === "bad") {
            setError("Part of the agent's answer could not be read.");
            continue;
          }
          const parsed = event as StreamEvent;
          setEvents((list) => [...list, parsed]);
          if (parsed.type === "ended") setEnded(parsed);
        }
      }
    } catch {
      setError("The connection dropped. Try again.");
    } finally {
      setRunning(false);
    }
  }

  async function approve(draft: string) {
    setApproval({ phase: "saving" });
    try {
      const res = await fetch("/api/agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) setApproval({ phase: "error", message: data.error ?? "Could not save." });
      else setApproval({ phase: "done", message: data.message ?? "Done." });
    } catch {
      setApproval({ phase: "error", message: "Could not save. Try again." });
    }
  }

  return (
    <section aria-labelledby="agent-heading" className="flex flex-col gap-4">
      <h2 id="agent-heading" className="caps text-sm text-zinc-50">
        Plan trip with the agent
      </h2>
      <p className="text-sm text-zinc-300">
        The agent checks the rider file and proposes one trip. Nothing is booked. Saving happens
        only when you press Approve.
      </p>
      <button
        type="button"
        disabled={running || !valid.ok}
        onClick={() => stream({ note: valid.ok ? valid.note : "", timeZone: browserTimeZone() })}
        className="caps bg-accent text-accent-ink focus-visible:outline-accent inline-flex min-h-11 w-fit items-center px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        Plan trip (agent)
      </button>
      {!valid.ok && <p className="text-sm text-zinc-400">Type a note above first.</p>}
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}

      <ol
        aria-live="polite"
        aria-label="Agent steps"
        className="flex flex-col gap-2 text-sm text-zinc-200"
      >
        {events.map((event, i) => (
          <TimelineItem key={i} event={event} />
        ))}
      </ol>

      {ended?.status === "proposed" && (
        <ProposedCard ended={ended} approval={approval} onApprove={() => approve(ended.draft)} />
      )}
      {ended?.status === "needs_info" && (
        <Question
          question={ended.question}
          options={ended.options}
          disabled={running}
          onChoose={(choice) =>
            stream({ resume: { token: ended.resume, choice }, timeZone: browserTimeZone() })
          }
        />
      )}
      {ended?.status === "failed" && (
        <p role="status" className="text-sm text-zinc-300">
          {REASON_WORDS[ended.reason] ?? "The run stopped."} No trip was proposed.
        </p>
      )}
      {ended && <Summary ended={ended} />}
    </section>
  );
}

function TimelineItem({ event }: { event: StreamEvent }) {
  switch (event.type) {
    case "run_started":
      return <li className="text-zinc-400">Started.</li>;
    case "parsed":
      return (
        <li className="text-zinc-400">
          Read the note: {event.trip.passenger_name ?? "no passenger named"}.
        </li>
      );
    case "step":
      return (
        <li>
          Step {event.step}:{" "}
          {event.calls.length === 0
            ? "no tool was used."
            : event.calls
                .map((c) =>
                  c.is_error
                    ? `${TOOL_WORDS[c.name] ?? c.name} (did not work: ${c.content})`
                    : (TOOL_WORDS[c.name] ?? c.name),
                )
                .join(", ")}
        </li>
      );
    case "error":
      return <li className="text-red-300">The agent stopped early.</li>;
    default:
      return null;
  }
}

function ProposedCard({
  ended,
  approval,
  onApprove,
}: {
  ended: Extract<Ended, { status: "proposed" }>;
  approval: Approval;
  onApprove: () => void;
}) {
  const merged: MergedTrip = ended.merged;
  const trip = merged.trip;
  return (
    <div className="border-etch flex flex-col gap-2 border p-4">
      <p className="text-zinc-50">
        {trip.passenger_name ?? "Passenger not named"}, {trip.pickup_date} at {trip.pickup_time}
      </p>
      <p className="text-sm text-zinc-300">Pickup: {trip.pickup_location ?? "not given"}</p>
      <p className="text-sm text-zinc-300">Drop-off: {trip.dropoff_location ?? "not given"}</p>
      <ul className="flex flex-wrap gap-2 text-xs">
        <li className="border-etch border px-2 py-1">{SOURCE_BADGE[merged.sources.pickup]}</li>
        {merged.sources.mobility !== "none" && (
          <li className="border-etch border px-2 py-1">
            mobility {SOURCE_BADGE[merged.sources.mobility]}
          </li>
        )}
        {merged.conflicts.length > 0 && (
          <li className="border border-red-400 px-2 py-1 text-red-300">conflict: mobility</li>
        )}
      </ul>
      {approval.phase === "done" ? (
        <p role="status" className="text-sm text-zinc-200">
          {approval.message}
        </p>
      ) : (
        <button
          type="button"
          onClick={onApprove}
          disabled={approval.phase === "saving"}
          className="caps bg-accent text-accent-ink focus-visible:outline-accent inline-flex min-h-11 w-fit items-center px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
        >
          Approve
        </button>
      )}
      {approval.phase === "error" && (
        <p role="alert" className="text-sm text-red-300">
          {approval.message}
        </p>
      )}
    </div>
  );
}

function Question({
  question,
  options,
  disabled,
  onChoose,
}: {
  question: string;
  options: AskOption[];
  disabled: boolean;
  onChoose: (choice: number) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-zinc-50">{question}</legend>
      {options.map((option, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChoose(i)}
          className="border-etch hover:border-accent focus-visible:outline-accent min-h-11 border px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

function Summary({ ended }: { ended: Ended }) {
  const { steps, inputTokens, outputTokens, latencyMs } = ended.usage;
  return (
    <p className="text-xs text-zinc-400">
      {steps} {steps === 1 ? "step" : "steps"}, {inputTokens + outputTokens} tokens,{" "}
      {Math.round(latencyMs / 100) / 10} s.
    </p>
  );
}
