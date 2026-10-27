/** @jest-environment node */
import { API_EXAMPLES, INVALID_EXAMPLES, VALID_EXAMPLES } from "./docs-examples";
import { validateNote } from "./validation";

describe("docs examples stay true to the validator", () => {
  it.each(VALID_EXAMPLES.map((e) => [e.title, e.note]))("accepts: %s", (_title, note) => {
    expect(validateNote(note).ok).toBe(true);
  });

  it.each(INVALID_EXAMPLES.map((e) => [e.title, e.note, e.code]))(
    "rejects with the documented code: %s",
    (_title, note, code) => {
      const result = validateNote(note);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe(code);
    },
  );

  it("documents each validation code at least once", () => {
    const codes = new Set(INVALID_EXAMPLES.map((e) => e.code));
    expect(codes).toEqual(
      new Set(["required", "too_short", "too_long", "hidden_characters", "markup"]),
    );
  });

  it("lists API examples as parseable or not exactly as documented", () => {
    const notJson = API_EXAMPLES.filter(
      (e) => e.status === 400 && e.result.includes("invalid JSON"),
    );
    for (const ex of notJson) expect(() => JSON.parse(ex.body)).toThrow();
  });
});
