import type Anthropic from "@anthropic-ai/sdk";
import type { AgentModel, ModelReply } from "./types";

/**
 * A stand-in for the agent's model, used only by the browser tests (see `stubActive`, which refuses
 * a production build). It follows one simple rule and makes no judgement: search for the passenger,
 * propose when exactly one rider matches, ask when none or several do. It reads the trip only from
 * the `E2E:` note the stub understands, so a stubbed run can never be mistaken for a real one.
 */
type Trip = {
  passenger_name: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
};

function textOf(message: Anthropic.MessageParam | undefined): string {
  if (!message) return "";
  return typeof message.content === "string"
    ? message.content
    : message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

function tripFrom(text: string): Trip {
  const start = text.indexOf("E2E:");
  if (start === -1) throw new Error("fake agent: note has no E2E: trip");
  const end = text.lastIndexOf("\n</note>");
  const trip = JSON.parse(text.slice(start + 4, end === -1 ? undefined : end)) as Trip;
  return trip;
}

function reply(name: string, input: unknown): ModelReply {
  return {
    content: [
      {
        type: "tool_use",
        caller: { type: "direct" },
        id: `fake_${name}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        input,
      },
    ] as Anthropic.ContentBlock[],
    stop_reason: "tool_use",
    usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0 },
  };
}

const ask = (question: string, options: { label: string; rider_id: string | null }[]) =>
  reply("ask_dispatcher", { question, options });

/** The content of the newest find_rider result, when the last step was a find_rider call. */
function lastFindResult(messages: Anthropic.MessageParam[]): string | undefined {
  const last = messages.at(-1);
  const before = messages.at(-2);
  if (!last || typeof last.content === "string" || !before || typeof before.content === "string") {
    return undefined;
  }
  const call = before.content.find((b) => b.type === "tool_use");
  if (!call || call.type !== "tool_use" || call.name !== "find_rider") return undefined;
  const result = last.content.find((b) => b.type === "tool_result");
  if (!result || result.type !== "tool_result") return undefined;
  return typeof result.content === "string" ? result.content : undefined;
}

export function fakeAgentModel(): AgentModel {
  return async ({ messages }) => {
    const first = textOf(messages[0]);

    if (first.includes("The dispatcher answered")) {
      const rider = /Rider id: (\S+?)\./.exec(first)?.[1];
      const when = /Pickup date (\S+), pickup time (\S+?)\./.exec(first);
      if (!rider || !when || when[1] === "unknown")
        return ask("Which rider?", [{ label: "Try again", rider_id: null }]);
      return reply("propose_trip", {
        rider_id: rider,
        pickup_date: when[1],
        pickup_time: when[2],
        reasons: [],
      });
    }

    const trip = tripFrom(first);
    if (trip.passenger_name === null) {
      return ask("Which passenger?", [{ label: "Give a name", rider_id: null }]);
    }
    if (trip.pickup_date === null || trip.pickup_time === null) {
      return ask("What date and time?", [{ label: "Give a date and time", rider_id: null }]);
    }

    const found = lastFindResult(messages);
    if (found === undefined) return reply("find_rider", { name: trip.passenger_name });
    const riders = (JSON.parse(found) as { riders?: { id: string; name: string; home: string }[] })
      .riders;
    if (!riders || riders.length === 0) {
      return ask("Which rider is this?", [{ label: "Someone else", rider_id: null }]);
    }
    if (riders.length === 1) {
      return reply("propose_trip", {
        rider_id: riders[0].id,
        pickup_date: trip.pickup_date,
        pickup_time: trip.pickup_time,
        reasons: [],
      });
    }
    return ask(
      "Which rider do you mean?",
      riders.map((r) => ({ label: `${r.name}, ${r.home}`, rider_id: r.id })),
    );
  };
}
