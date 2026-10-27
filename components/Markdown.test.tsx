import { render, screen } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders headings with ids, paragraphs, lists, code and rules", () => {
    const { container } = render(
      <Markdown
        skipTitle={false}
        source={"# Title\n\ntext **bold** _em_ `code`\n\n- a\n- b\n\n1. x\n\n```\nraw\n```\n\n---"}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Title" })).toHaveAttribute("id", "title");
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("em")).toHaveTextContent("em");
    expect(container.querySelectorAll("code")).toHaveLength(1);
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(1);
    expect(container.querySelector("pre")).toHaveTextContent("raw");
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("drops the first title by default, since the page shows its own", () => {
    render(<Markdown source={"# Title\n\n## Next"} />);
    expect(screen.queryByRole("heading", { name: "Title" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Next" })).toBeInTheDocument();
  });

  it("keeps in-page and external links, and marks external ones noopener", () => {
    render(<Markdown source={"[in](#x) and [out](https://example.com)"} />);
    expect(screen.getByRole("link", { name: "in" })).toHaveAttribute("href", "#x");
    expect(screen.getByRole("link", { name: "out" })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("points guide-to-guide links at the site's pages", () => {
    render(<Markdown source={"[FAQ](FAQ.md) and [Eval](EVAL.md)"} />);
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/docs/faq");
    expect(screen.getByRole("link", { name: "Eval" })).toHaveAttribute("href", "/docs/eval");
  });

  it("shows links to repository-only files as plain text, not dead links", () => {
    render(<Markdown source={"See [the README](../README.md)."} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("the README")).toBeInTheDocument();
  });

  it("keeps a link whose target is a site path", () => {
    render(<Markdown source={"[home](/docs)"} />);
    expect(screen.getByRole("link", { name: "home" })).toHaveAttribute("href", "/docs");
  });

  it.each([
    ["a javascript: link", "[x](javascript:alert(1))"],
    ["a data: link", "[x](data:text/html,hi)"],
    ["a protocol-relative link to another site", "[x](//evil.example/path)"],
    ["a vbscript: link", "[x](vbscript:msgbox(1))"],
  ])("never turns %s into a link", (_name, source) => {
    const { container } = render(<Markdown source={source} />);
    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("x")).toBeInTheDocument();
  });
});
