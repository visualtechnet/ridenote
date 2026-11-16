/** Why a request body could not be used: too big, or the connection failed while it was being sent. */
export type BodyResult =
  { ok: true; text: string } | { ok: false; reason: "too_large" | "unreadable" };

/**
 * Reads a request body as text but gives up as soon as it exceeds `maxBytes`, so an oversized or
 * unlabelled (chunked) upload is never fully buffered. Never throws: a client that drops the
 * connection mid-upload is reported as `unreadable`, not as a server error.
 */
export async function readBodyText(req: Request, maxBytes: number): Promise<BodyResult> {
  if (!req.body) return { ok: true, text: "" };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}
