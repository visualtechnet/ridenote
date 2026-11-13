import { z } from "zod";
import { AGENT } from "../config";
import type { Trip } from "../trip";
import { TOOL_ERRORS } from "./errors";
import { riderById } from "./riders";
import { sign, verify } from "./sign";
import type { AskOption, ToolContext, ToolDef, ToolResult } from "./types";

export type { AskOption } from "./types";

export type ResumePayload = {
  v: 1;
  run_id: string;
  parsed: Trip;
  question: string;
  options: AskOption[];
  exp: number;
};

export const AskDispatcherInput = z.strictObject({
  question: z.string().trim().min(1).max(AGENT.questionMax),
  options: z
    .array(
      z.strictObject({
        label: z.string().trim().min(1).max(AGENT.optionLabelMax),
        rider_id: z.string().min(1).max(AGENT.nameMax).nullable(),
      }),
    )
    .min(1)
    .max(AGENT.maxOptions),
});

export const askDispatcherDef: ToolDef = {
  name: "ask_dispatcher",
  description:
    "Ask the dispatcher one question. This ends your work until they answer. Use it when find_rider returned more than one rider, when the date, time, drop-off or mobility is unknown, or when a tool keeps failing. Give 1 to 4 options. For an option that means one rider, set rider_id to that rider's id; otherwise set it to null. Do not use it to ask something a tool can answer.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      question: { type: "string", description: "One short question for the dispatcher" },
      options: {
        type: "array",
        description: "1 to 4 answers the dispatcher can choose from",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "The answer, as the dispatcher will read it" },
            rider_id: {
              type: ["string", "null"],
              description: "The rider's id when the option means one rider, otherwise null",
            },
          },
          required: ["label", "rider_id"],
          additionalProperties: false,
        },
      },
    },
    required: ["question", "options"],
    additionalProperties: false,
  },
};

export function askDispatcher(
  input: z.infer<typeof AskDispatcherInput>,
  ctx: ToolContext,
): ToolResult {
  for (const option of input.options) {
    if (option.rider_id !== null && !riderById(ctx.riders, option.rider_id)) {
      return { content: TOOL_ERRORS.unknownRider(option.rider_id), is_error: true };
    }
  }
  const payload: ResumePayload = {
    v: 1,
    run_id: ctx.runId,
    parsed: ctx.parsed,
    question: input.question,
    options: input.options,
    exp: ctx.clock.now.getTime() + AGENT.tokenTtlMs,
  };
  const resume = sign(payload, ctx.secret);
  return {
    content: JSON.stringify({ asked: true }),
    end: { status: "needs_info", question: input.question, options: input.options, resume },
  };
}

export function checkResumeChoice(
  token: string,
  choice: number,
  secret: string,
  now: Date,
):
  | { ok: true; payload: ResumePayload; option: AskOption }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "not_offered" } {
  const verified = verify<ResumePayload>(token, secret, now);
  if (!verified.ok) return verified;
  const option = Number.isInteger(choice) ? verified.payload.options[choice] : undefined;
  if (option === undefined) return { ok: false, reason: "not_offered" };
  return { ok: true, payload: verified.payload, option };
}
