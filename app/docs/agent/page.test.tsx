import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import Page from "./page";

describe("Agent page", () => {
  it("has one h1 and a heading for each of the ten sections", () => {
    render(<Page />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "The agent, its loop and its evals" }),
    ).toBeInTheDocument();
    for (const name of [
      /^what this is$/i,
      /^a run, step by step$/i,
      /^the four tools$/i,
      /^the loop$/i,
      /^staying safe$/i,
      /^replay$/i,
      /^evals: testing an agent$/i,
      /^words you will meet$/i,
      /^check yourself$/i,
      /^what is built and what is not yet$/i,
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
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
