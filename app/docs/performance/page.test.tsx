import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import Page from "./page";

describe("Performance page", () => {
  it("has one h1 named Performance, cost and abuse protection", () => {
    render(<Page />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Performance, cost and abuse protection" }),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Page />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
