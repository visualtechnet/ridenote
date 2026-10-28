/**
 * A deliberately small Markdown reader for the guides in docs/. It understands only what those files
 * use (headings, paragraphs, lists, tables, fenced code, rules, and `code`, **bold**, _italic_ and
 * links inside text), so the site and the repository can share one source without a Markdown
 * dependency. Anything fancier (images, HTML) is not supported and shows up as plain text.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: number; id: string; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "code"; text: string }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] }
  | { type: "rule" };

// Code first, so markers inside backticks are left alone. Underscore emphasis must not touch
// snake_case words, hence the word-character guards.
const TOKEN = /`([^`]+)`|\*\*(.+?)\*\*|(?<!\w)_(.+?)_(?!\w)|\[([^\]]+)\]\(([^)\s]+)\)/;

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let rest = source;
  while (rest) {
    const m = TOKEN.exec(rest);
    if (!m) break;
    if (m.index > 0) out.push({ type: "text", text: rest.slice(0, m.index) });
    if (m[1] !== undefined) out.push({ type: "code", text: m[1] });
    else if (m[2] !== undefined) out.push({ type: "strong", children: parseInline(m[2]) });
    else if (m[3] !== undefined) out.push({ type: "em", children: parseInline(m[3]) });
    else out.push({ type: "link", href: m[5], children: parseInline(m[4]) });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push({ type: "text", text: rest });
  return out;
}

export function plainText(inline: Inline[]): string {
  return inline
    .map((n) => (n.type === "text" || n.type === "code" ? n.text : plainText(n.children)))
    .join("");
}

/** GitHub-style anchor: lower case, punctuation dropped, spaces to hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

const HEADING = /^(#{1,3}) +(.+?)\s*$/;
const LIST_ITEM = /^(?:[-*]|\d+\.) +(.*)$/;
const ORDERED_ITEM = /^\d+\. /;
const RULE = /^-{3,}\s*$/;
const FENCE = /^```/;

const TABLE_ROW = /^\s*\|.*\|\s*$/;
// A table's second line: cells of dashes, optionally with alignment colons, e.g. | --- | :-: |
const TABLE_DIVIDER = /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/;

const startsTable = (lines: string[], i: number) =>
  TABLE_ROW.test(lines[i]) && TABLE_DIVIDER.test(lines[i + 1] ?? "");

const startsBlock = (lines: string[], i: number) =>
  HEADING.test(lines[i]) ||
  LIST_ITEM.test(lines[i]) ||
  RULE.test(lines[i]) ||
  FENCE.test(lines[i]) ||
  startsTable(lines, i);

/** Splits a table row into cells. A pipe inside `code` or written as \| belongs to the cell. */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inCode = false;
  const body = line.trim().slice(1, -1);
  for (let k = 0; k < body.length; k++) {
    const ch = body[k];
    if (ch === "\\" && body[k + 1] === "|") {
      cell += "|";
      k++;
    } else if (ch === "`") {
      inCode = !inCode;
      cell += ch;
    } else if (ch === "|" && !inCode) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/**
 * `skipTitle` drops the first `# ` heading: the page already shows its own title as the h1.
 * Heading levels are shifted down one and never skip a level, so the page outline stays valid.
 */
export function parseMarkdown(source: string, options: { skipTitle?: boolean } = {}): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  const seen = new Map<string, number>();
  let lastLevel = 1;
  let skip = options.skipTitle ?? false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
    } else if (FENCE.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i++; // the closing fence
      blocks.push({ type: "code", text: body.join("\n") });
    } else if (startsTable(lines, i)) {
      const header = splitRow(line);
      i += 2; // the header and its divider
      const rows: string[][] = [];
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        // Ragged rows are padded or cut to the header's width so every row has the same columns.
        const cells = splitRow(lines[i++]);
        rows.push(header.map((_, c) => cells[c] ?? ""));
      }
      blocks.push({
        type: "table",
        header: header.map(parseInline),
        rows: rows.map((row) => row.map(parseInline)),
      });
    } else if (RULE.test(line)) {
      blocks.push({ type: "rule" });
      i++;
    } else if (HEADING.test(line)) {
      const [, hashes, text] = HEADING.exec(line)!;
      i++;
      if (skip && hashes.length === 1) {
        skip = false;
        continue;
      }
      const children = parseInline(text);
      const base = slugify(plainText(children));
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      lastLevel = Math.min(hashes.length + 1, lastLevel + 1);
      blocks.push({
        type: "heading",
        level: lastLevel,
        id: count ? `${base}-${count}` : base,
        children,
      });
    } else if (LIST_ITEM.test(line)) {
      const ordered = ORDERED_ITEM.test(line);
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i];
        const sameKind = (l: string) => LIST_ITEM.test(l) && ORDERED_ITEM.test(l) === ordered;
        if (LIST_ITEM.test(current) && !sameKind(current)) {
          break; // a numbered list directly after a bullet list (or the reverse) is a new list
        } else if (LIST_ITEM.test(current)) {
          items.push(LIST_ITEM.exec(current)![1]);
          i++;
        } else if (/^\s+\S/.test(current) && items.length) {
          items[items.length - 1] += ` ${current.trim()}`; // an indented continuation line
          i++;
        } else if (!current.trim() && sameKind(lines[i + 1] ?? "")) {
          i++; // a blank line between items of the same list
        } else {
          break;
        }
      }
      blocks.push({ type: "list", ordered, items: items.map(parseInline) });
    } else {
      const text: string[] = [];
      while (i < lines.length && lines[i].trim() && (!text.length || !startsBlock(lines, i))) {
        text.push(lines[i++].trim());
      }
      blocks.push({ type: "paragraph", children: parseInline(text.join(" ")) });
    }
  }
  return blocks;
}
