import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import BusinessPage from "./page";

describe("Business page", () => {
  it("has one h1 and the plain-language sections as h2 headings", () => {
    render(<BusinessPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 2, name: /what ridenote does/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /what it will not do/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /words you will see/i }),
    ).toBeInTheDocument();
  });

  it("links the contents to headings that exist", () => {
    const { container } = render(<BusinessPage />);
    const anchors = [...container.querySelectorAll('a[href^="#"]')];
    for (const a of anchors) {
      expect(container.querySelector(`[id="${a.getAttribute("href")!.slice(1)}"]`)).not.toBeNull();
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<BusinessPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
