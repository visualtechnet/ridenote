import type Anthropic from "@anthropic-ai/sdk";

const PREFIX = "E2E:";

/**
 * Browser tests only. True only outside a production build and only with E2E_STUB_PARSE=1, so no
 * deployed site can ever answer from a stub. NODE_ENV is set by Next itself, not by the host.
 */
export function stubActive(
  env: { NODE_ENV?: string; E2E_STUB_PARSE?: string } = process.env,
): boolean {
  // The literal process.env.NODE_ENV is replaced by Next when it builds, so a production build
  // is refused whatever the environment says at run time. The env argument is only for tests.
  if (process.env.NODE_ENV === "production") return false;
  return (env.NODE_ENV === "development" || env.NODE_ENV === "test") && env.E2E_STUB_PARSE === "1";
}

/**
 * Stands in for the paid model: a note of the form `E2E:{...trip JSON...}` comes back as the
 * parsed output, so the real validation, normalisation, scrubbing and saving all still run.
 * Anything else throws, so a stubbed run can never be mistaken for a real parse.
 */
export function createStubClient(): Pick<Anthropic, "messages"> {
  return {
    messages: {
      async create(params: { messages: { content: unknown }[] }) {
        const content = String(params.messages[0]?.content ?? "");
        const start = content.indexOf(PREFIX);
        if (start === -1) throw new Error("stub: note has no E2E: prefix");
        const end = content.lastIndexOf("\n</note>");
        const json = content.slice(start + PREFIX.length, end === -1 ? undefined : end);
        return {
          stop_reason: "end_turn",
          content: [{ type: "text", text: JSON.stringify(JSON.parse(json)) }],
          usage: { input_tokens: 0, output_tokens: 0 },
        };
      },
    },
  } as unknown as Pick<Anthropic, "messages">;
}
