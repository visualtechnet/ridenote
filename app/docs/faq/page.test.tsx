import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import FaqPage from "./page";

describe("FAQ page", () => {
  it("has one h1 and the two parts as h2 headings", () => {
    render(<FaqPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: /part 1/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /part 2/i })).toBeInTheDocument();
  });

  it("shows the questions and the bugs found while building the eval", () => {
    render(<FaqPage />);
    expect(screen.getByRole("heading", { name: /what is the eval/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /pasted emails were refused/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /stand-in AI/i })).toBeInTheDocument();
  });

  it("links the contents to headings that exist", () => {
    const { container } = render(<FaqPage />);
    const anchors = [...container.querySelectorAll('a[href^="#"]')];
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) {
      expect(container.querySelector(`[id="${a.getAttribute("href")!.slice(1)}"]`)).not.toBeNull();
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<FaqPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
