/** @jest-environment node */
import { parseInline, parseMarkdown, plainText, slugify } from "./markdown";

describe("parseInline", () => {
  it("reads code, bold, italic and links", () => {
    expect(parseInline("a `b` **c** _d_ [e](#f)")).toEqual([
      { type: "text", text: "a " },
      { type: "code", text: "b" },
      { type: "text", text: " " },
      { type: "strong", children: [{ type: "text", text: "c" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "d" }] },
      { type: "text", text: " " },
      { type: "link", href: "#f", children: [{ type: "text", text: "e" }] },
    ]);
  });

  it("leaves markers inside code alone", () => {
    expect(parseInline("`**not bold**`")).toEqual([{ type: "code", text: "**not bold**" }]);
  });

  it("does not treat underscores in snake_case words as italics", () => {
    expect(parseInline("set missing_fields and pickup_time")).toEqual([
      { type: "text", text: "set missing_fields and pickup_time" },
    ]);
  });

  it("reads a link inside bold", () => {
    const [node] = parseInline("**[Part](#p)**");
    expect(node).toMatchObject({ type: "strong", children: [{ type: "link", href: "#p" }] });
  });

  it("returns plain text unchanged", () => {
    expect(plainText(parseInline("hello **big** `world`"))).toBe("hello big world");
  });
});

describe("slugify", () => {
  it.each([
    ["Part 1: Questions people ask", "part-1-questions-people-ask"],
    [
      "Part 2: Mistakes and bugs, and what they taught us",
      "part-2-mistakes-and-bugs-and-what-they-taught-us",
    ],
    ["Why is `<` sometimes refused?", "why-is--sometimes-refused"],
    ["Café menu", "café-menu"],
  ])("%s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("parseMarkdown", () => {
  it("skips the first title when asked, and shifts the other headings down", () => {
    const blocks = parseMarkdown("# Title\n\n# Part\n\n### Question", { skipTitle: true });
    expect(blocks.map((b) => (b.type === "heading" ? [b.level, b.id] : b.type))).toEqual([
      [2, "part"],
      [3, "question"],
    ]);
  });

  it("keeps the title when not skipping", () => {
    expect(parseMarkdown("# Title")[0]).toMatchObject({ type: "heading", level: 2 });
  });

  it("never skips a heading level", () => {
    const levels = parseMarkdown("# A\n## B\n### C\n## D\n### E\n# F")
      .filter((b) => b.type === "heading")
      .map((b) => (b.type === "heading" ? b.level : 0));
    expect(levels).toEqual([2, 3, 4, 3, 4, 2]);
  });

  it("gives repeated headings different ids", () => {
    const ids = parseMarkdown("## Same\n\n## Same")
      .filter((b) => b.type === "heading")
      .map((b) => (b.type === "heading" ? b.id : ""));
    expect(ids).toEqual(["same", "same-1"]);
  });

  it("joins wrapped lines into one paragraph and splits on blank lines", () => {
    const blocks = parseMarkdown("one\ntwo\n\nthree");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "paragraph", children: [{ text: "one two" }] });
  });

  it("ends a paragraph where a list starts", () => {
    expect(parseMarkdown("intro\n- a\n- b").map((b) => b.type)).toEqual(["paragraph", "list"]);
  });

  it("reads bullet and numbered lists, with indented continuation lines", () => {
    const [bullets, numbers] = parseMarkdown("- a\n  more\n- b\n\n1. x\n2. y");
    expect(bullets).toMatchObject({ type: "list", ordered: false });
    expect(bullets.type === "list" && bullets.items).toHaveLength(2);
    expect(bullets.type === "list" && plainText(bullets.items[0])).toBe("a more");
    expect(numbers).toMatchObject({ type: "list", ordered: true });
  });

  it("starts a new list when the kind changes with no blank line between", () => {
    expect(parseMarkdown("- a\n1. x").map((b) => b.type)).toEqual(["list", "list"]);
  });

  it("keeps one list across a blank line between items", () => {
    const blocks = parseMarkdown("- a\n\n- b");
    expect(blocks).toHaveLength(1);
  });

  it("reads fenced code verbatim", () => {
    const [code] = parseMarkdown("```bash\nnpm run eval  # **not bold**\n```");
    expect(code).toEqual({ type: "code", text: "npm run eval  # **not bold**" });
  });

  it("reads a horizontal rule", () => {
    expect(parseMarkdown("---")).toEqual([{ type: "rule" }]);
  });

  it("handles Windows line endings", () => {
    expect(parseMarkdown("# A\r\n\r\ntext")).toHaveLength(2);
  });

  it("reads the real guides without losing any heading", () => {
    // Every "#"-style line in the FAQ becomes a heading: nothing is swallowed into a paragraph.
    const { readFileSync } = jest.requireActual("node:fs") as typeof import("node:fs");
    for (const file of ["docs/FAQ.md", "docs/EVAL.md"]) {
      const text = readFileSync(file, "utf8");
      const expected = text.split("\n").filter((l) => /^#{1,3} /.test(l)).length - 1;
      const got = parseMarkdown(text, { skipTitle: true }).filter((b) => b.type === "heading");
      expect(got).toHaveLength(expected);
    }
  });
});

describe("parseMarkdown tables", () => {
  const table = "| Word | Means |\n| --- | --- |\n| **A** | one `x` |\n| B | two |";

  it("reads a header and its rows, with inline formatting in the cells", () => {
    const [block] = parseMarkdown(table);
    expect(block).toMatchObject({ type: "table" });
    if (block.type !== "table") throw new Error("not a table");
    expect(block.header.map(plainText)).toEqual(["Word", "Means"]);
    expect(block.rows.map((row) => row.map(plainText))).toEqual([
      ["A", "one x"],
      ["B", "two"],
    ]);
    expect(block.rows[0][0][0]).toMatchObject({ type: "strong" });
  });

  it("keeps a pipe inside code or escaped as \\| within its cell", () => {
    const [block] = parseMarkdown("| a | b |\n|---|---|\n| `x | y` | p \\| q |");
    if (block.type !== "table") throw new Error("not a table");
    expect(block.rows[0].map(plainText)).toEqual(["x | y", "p | q"]);
  });

  it("pads short rows and cuts long ones to the header width", () => {
    const [block] = parseMarkdown("| a | b |\n| - | - |\n| 1 |\n| 1 | 2 | 3 |");
    if (block.type !== "table") throw new Error("not a table");
    expect(block.rows.map((row) => row.map(plainText))).toEqual([
      ["1", ""],
      ["1", "2"],
    ]);
  });

  it("accepts alignment colons in the divider", () => {
    expect(parseMarkdown("| a | b |\n| :-- | --: |\n| 1 | 2 |")[0].type).toBe("table");
  });

  it("ends a paragraph where a table starts, and the table where a blank line comes", () => {
    const blocks = parseMarkdown(`intro line\n${table}\n\nafter`);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "table", "paragraph"]);
  });

  it("leaves pipes without a divider row as plain text", () => {
    expect(parseMarkdown("| not | a table |")[0].type).toBe("paragraph");
  });
});
