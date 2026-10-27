import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import DocsPage from "./page";
import { INVALID_EXAMPLES, VALID_EXAMPLES } from "@/lib/docs-examples";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe("Docs page", () => {
  it("covers setup, accepted and rejected inputs, JSON and errors", () => {
    render(<DocsPage />);
    for (const name of [
      "Setup",
      /accepted inputs/i,
      /rejected inputs/i,
      /break the JSON/i,
      /what the errors mean/i,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("explains 400, 404 and the other statuses", () => {
    render(<DocsPage />);
    for (const status of ["400", "404", "413", "422", "429", "502"]) {
      expect(screen.getAllByRole("rowheader", { name: status }).length).toBeGreaterThan(0);
    }
  });

  it("offers a Try button for every accepted example only", () => {
    render(<DocsPage />);
    expect(screen.getAllByRole("button", { name: /try in the parser/i })).toHaveLength(
      VALID_EXAMPLES.length,
    );
    expect(
      screen.getAllByText(/^(required|too_short|too_long|hidden_characters|markup)$/).length,
    ).toBeGreaterThanOrEqual(INVALID_EXAMPLES.length);
  });

  it("never shows a secret", () => {
    const { container } = render(<DocsPage />);
    expect(container.textContent).not.toMatch(/sk-ant-/);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<DocsPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
