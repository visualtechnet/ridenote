export const REMOVED = "[removed]";

/**
 * Ordered rules; each match becomes REMOVED. Add a new pattern here. Best effort: this is
 * pattern matching, so it catches these formats and cannot recognise every personal detail.
 * Street numbers, 5-digit zip codes, "Apt 4B" and times are deliberately left alone.
 */
const RULES: { name: string; pattern: RegExp }[] = [
  { name: "link", pattern: /\b(?:https?:\/\/|www\.)\S+/gi },
  { name: "email", pattern: /[^\s@]+@[^\s@]+\.[^\s@]+/g },
  {
    // A label plus the value after it. The value must contain a digit, so "member services" stays.
    // A bare "ID" needs a ":" or "#", so the state in "Boise, ID 83702" stays.
    name: "labelled value",
    pattern:
      /(?:\b(?:dob|ssn|member|policy|account|medicaid|medicare|insurance)\b(?:\s+(?:id|number|no\.?))*\s*[:#]?|\bid\s*[:#])\s*(?=[a-z0-9/-]*\d)[a-z0-9][a-z0-9/-]*/gi,
  },
  // +country code, then groups of digits
  {
    name: "international phone",
    pattern: /(?<!\w)\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?!\d)/g,
  },
  { name: "US phone", pattern: /(?<!\d)(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?!\d)/g },
  // 9 or more digits, optionally split by single spaces or dashes: SSN, card, account numbers
  { name: "long digit run", pattern: /(?<!\d)\d(?:[\s-]?\d){8,}(?!\d)/g },
];

export function scrubText(text: string | null): string | null {
  if (text === null) return null;
  try {
    return RULES.reduce((out, { pattern }) => out.replace(pattern, REMOVED), text);
  } catch {
    // Never let the scrubber break a parse; saving nothing is safer than saving unscrubbed text.
    return REMOVED;
  }
}
