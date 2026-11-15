/** @jest-environment node */
import { readBodyText } from "./read-body";

function streamOf(chunks: Uint8Array[], onCancel?: () => void) {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
    cancel: onCancel,
  });
}

const bytes = (s: string) => new TextEncoder().encode(s);
const req = (body: ReadableStream<Uint8Array> | null) => ({ body }) as unknown as Request;

describe("readBodyText", () => {
  it("returns the full text when under the limit, across several chunks", async () => {
    const body = streamOf([bytes('{"note":'), bytes('"héllo"}')]);
    expect(await readBodyText(req(body), 100)).toEqual({ ok: true, text: '{"note":"héllo"}' });
  });

  it("accepts a body of exactly the limit", async () => {
    expect(await readBodyText(req(streamOf([bytes("abcde")])), 5)).toEqual({
      ok: true,
      text: "abcde",
    });
  });

  it("reports too_large once the limit is exceeded, and cancels the stream without reading the rest", async () => {
    let pulled = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(bytes("x".repeat(10)));
      },
      cancel() {
        cancelled = true;
      },
    });
    expect(await readBodyText(req(body), 25)).toEqual({ ok: false, reason: "too_large" });
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThan(10); // an endless stream never gets buffered
  });

  it("counts bytes, not characters", async () => {
    expect(await readBodyText(req(streamOf([bytes("ééé")])), 5)).toEqual({
      ok: false,
      reason: "too_large",
    }); // 6 bytes
  });

  it("returns an empty string when there is no body", async () => {
    expect(await readBodyText(req(null), 10)).toEqual({ ok: true, text: "" });
  });

  it("reports unreadable, not a throw, when the client drops the connection mid-upload", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes('{"note":'));
        controller.error(new TypeError("connection reset"));
      },
    });
    expect(await readBodyText(req(body), 100)).toEqual({ ok: false, reason: "unreadable" });
  });
});
