/** @jest-environment node */
import { readLimitedText } from "./read-body";

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

describe("readLimitedText", () => {
  it("returns the full text when under the limit, across several chunks", async () => {
    const body = streamOf([bytes('{"note":'), bytes('"héllo"}')]);
    expect(await readLimitedText(req(body), 100)).toBe('{"note":"héllo"}');
  });

  it("accepts a body of exactly the limit", async () => {
    expect(await readLimitedText(req(streamOf([bytes("abcde")])), 5)).toBe("abcde");
  });

  it("returns null once the limit is exceeded, and cancels the stream without reading the rest", async () => {
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
    expect(await readLimitedText(req(body), 25)).toBeNull();
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThan(10); // an endless stream never gets buffered
  });

  it("counts bytes, not characters", async () => {
    expect(await readLimitedText(req(streamOf([bytes("ééé")])), 5)).toBeNull(); // 6 bytes
  });

  it("returns an empty string when there is no body", async () => {
    expect(await readLimitedText(req(null), 10)).toBe("");
  });
});
