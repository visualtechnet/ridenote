import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import TestsPage from "./page";

describe("Tests page", () => {
  it("lists real test files with their test names", () => {
    render(<TestsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Tests" })).toBeInTheDocument();
    expect(screen.getByText(/lib\/validation\.test\.ts/)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<TestsPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
