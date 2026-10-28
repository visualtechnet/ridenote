import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import Page from "./page";

describe("Agents plan page", () => {
  it("has one h1 and the document's headings", () => {
    render(<Page />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Implementation plan: History" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /review focus/i })).toBeInTheDocument();
  });

  it("links to headings that exist", () => {
    const { container } = render(<Page />);
    for (const a of container.querySelectorAll('a[href^="#"]')) {
      expect(container.querySelector(`[id="${a.getAttribute("href")!.slice(1)}"]`)).not.toBeNull();
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Page />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
