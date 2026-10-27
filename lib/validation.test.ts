/** @jest-environment node */
import { LIMITS } from "./config";
import { MESSAGES } from "./messages";
import { validateNote, validateRequestBody } from "./validation";

describe("validateNote: accepts good input", () => {
  it("accepts a normal note and trims surrounding whitespace", () => {
    expect(validateNote("  Pick up Lee at 9  ")).toEqual({ ok: true, note: "Pick up Lee at 9" });
  });

  it.each([
    ["multiple lines", "Pick up Lee\nDrop at County Hospital"],
    ["accents and non-Latin text", "Zoë Müller, 東京駅 → 病院, café"],
    ["emoji", "Pick up Sam 🚑 at 9am"],
    ["a comparison sign followed by a number", "Pickup in < 10 minutes at 5 Main St"],
    ["an arrow", "Main St -> County Hospital at 9am"],
    ["ampersands and quotes", `R&D building, "Door B", O'Neil`],
  ])("accepts %s", (_name, note) => {
    expect(validateNote(note).ok).toBe(true);
  });

  it(`accepts exactly ${LIMITS.noteMin} and ${LIMITS.noteMax} characters`, () => {
    expect(validateNote("a".repeat(LIMITS.noteMin)).ok).toBe(true);
    expect(validateNote("a".repeat(LIMITS.noteMax)).ok).toBe(true);
  });
});

describe("validateNote: friendly errors", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 5],
    ["an array", ["x"]],
    ["an object (validateNote takes text only)", { note: "Pick up Lee at 9" }],
    ["an empty string", ""],
    ["only whitespace", "   \n\t "],
  ])("asks for a note when given %s", (_name, input) => {
    expect(validateNote(input)).toEqual({
      ok: false,
      code: "required",
      message: MESSAGES.noteRequired,
    });
  });

  it("says when the note is too short", () => {
    const result = validateNote("a".repeat(LIMITS.noteMin - 1));
    expect(result).toEqual({ ok: false, code: "too_short", message: MESSAGES.noteTooShort });
  });

  it("says how long the note is when it is too long", () => {
    const result = validateNote("a".repeat(LIMITS.noteMax + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("too_long");
      expect(result.message).toContain((LIMITS.noteMax + 1).toLocaleString("en-US"));
      expect(result.message).toContain(LIMITS.noteMax.toLocaleString("en-US"));
    }
  });

  it("never exposes jargon or stack-trace style text in any message", () => {
    for (const input of [undefined, "ab", "a".repeat(3000), "<b>x</b>x", "x\u0000xxxx"]) {
      const result = validateNote(input);
      if (!result.ok) expect(result.message).not.toMatch(/undefined|null|exception|regex|NaN/i);
    }
  });
});

describe("validateNote: blocks script injection", () => {
  it.each([
    ["a script tag", "<script>alert(1)</script>"],
    ["an uppercase script tag", "<SCRIPT SRC=//evil.example></SCRIPT>"],
    ["an image with an event handler", "<img src=x onerror=alert(1)>"],
    ["an svg onload", "<svg/onload=alert(1)>"],
    ["an iframe", '<iframe src="https://evil.example"></iframe>'],
    ["a tag hidden after normal text", "Pick up Lee at 9am <b>now</b>"],
    ["a tag with leading space", "Pick up Lee < script>alert(1)</script>"],
    ["a closing tag", "Pick up Lee </note> extra"],
    ["an HTML comment", "Pick up Lee <!-- hidden --> at 9am"],
    ["a processing instruction", "Pick up Lee <?php echo 1 ?> at 9am"],
    ["a javascript: link", "Pick up Lee at javascript:alert(1)"],
    ["a mixed-case javascript: link", "Click JaVaScRiPt:alert(1) please"],
    ["a javascript: link with a space", "Click java script:alert(1) please"],
    ["a vbscript: link", "Click vbscript:msgbox(1) please"],
  ])("rejects %s with a friendly message", (_name, input) => {
    expect(validateNote(input)).toEqual({
      ok: false,
      code: "markup",
      message: MESSAGES.noteMarkup,
    });
  });

  it.each([
    ["a null byte", "Pick up Lee\u0000 at 9am"],
    ["an escape character", "Pick up Lee\u001b[31m at 9am"],
    ["a right-to-left override", "Pick up Lee ‮evil at 9am"],
    ["a zero-width space", "Pick up Lee\u200B at 9am"],
    ["a byte order mark", "\uFEFFPick up Lee at 9am"],
    ["a line separator", "Pick up Lee\u2028at 9am"],
    ["a word joiner", "Pick up Lee\u2060 at 9am"],
    ["a bidi isolate", "Pick up Lee ⁦hidden⁩ at 9am"],
  ])("rejects %s", (_name, input) => {
    expect(validateNote(input)).toEqual({
      ok: false,
      code: "hidden_characters",
      message: MESSAGES.noteHiddenCharacters,
    });
  });

  it.each([
    ["a joined family emoji", "Pick up the family \u{1F468}\u200D\u{1F469}\u200D\u{1F467} at 9am"],
    [
      "a zero-width non-joiner (Persian)",
      "Pick up \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645 at 9am",
    ],
  ])("still accepts %s", (_name, input) => {
    expect(validateNote(input).ok).toBe(true);
  });

  it.each([
    ["an email address in angle brackets", "Pick up Lee <lee@example.com> at 12 Oak St at 9am"],
    ["two of them", "From: Ann <ann@x.org>, Cc: Bo <bo.k+d@mail.example.co.uk>. Lee, 12 Oak, 9am"],
  ])("accepts %s (pasted from email)", (_name, input) => {
    expect(validateNote(input).ok).toBe(true);
  });

  it.each([
    ["a tag that only looks like an email", '<img@x.co onerror="alert(1)">'],
    ["a tag next to an email", "<lee@example.com><script>alert(1)</script>"],
    ["a script link inside brackets", "<javascript:alert(1)@x.com>"],
  ])("still rejects %s", (_name, input) => {
    expect(validateNote(input)).toMatchObject({ ok: false, code: "markup" });
  });

  it("returns the note in normalised (NFC) form", () => {
    const decomposed = "Café pickup at 9"; // "e" + combining accent
    const result = validateNote(decomposed);
    expect(result).toEqual({ ok: true, note: "Café pickup at 9" });
  });
});

describe("validateRequestBody (the API's stricter front door)", () => {
  it("accepts { note } and returns the trimmed note", () => {
    expect(validateRequestBody({ note: "  Pick up Lee at 9  " })).toEqual({
      ok: true,
      note: "Pick up Lee at 9",
    });
  });

  it("ignores extra fields instead of passing them along", () => {
    expect(validateRequestBody({ note: "Pick up Lee at 9", admin: true })).toEqual({
      ok: true,
      note: "Pick up Lee at 9",
    });
  });

  it.each([
    ["a bare string body", "Pick up Lee at 9"],
    ["null", null],
    ["undefined", undefined],
    ["an array", ["Pick up Lee at 9"]],
    ["a number", 42],
    ["an object without a note", {}],
    ["a non-string note", { note: 42 }],
    ["a query-operator style note", { note: { $gt: "" } }],
    ["a nested { note } object", { note: { note: "Pick up Lee at 9" } }],
    ["an empty note", { note: "" }],
  ])("rejects %s with the 'required' message", (_name, body) => {
    expect(validateRequestBody(body)).toEqual({
      ok: false,
      code: "required",
      message: MESSAGES.noteRequired,
    });
  });

  it("applies every note rule, including script blocking", () => {
    const result = validateRequestBody({ note: "<script>alert(document.cookie)</script>" });
    expect(result).toEqual({ ok: false, code: "markup", message: MESSAGES.noteMarkup });
  });

  it("applies the length limit", () => {
    const result = validateRequestBody({ note: "a".repeat(LIMITS.noteMax + 1) });
    expect(result.ok).toBe(false);
  });
});
