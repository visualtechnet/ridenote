import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { CASES } from "@/evals/cases";
import EvalPage from "./page";

describe("Eval page", () => {
  it("explains the eval and how it ties into the app", () => {
    render(<EvalPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Eval" })).toBeInTheDocument();
    for (const name of [/the model/i, /the prompt/i, /the schema/i, /validation/i]) {
      expect(screen.getByText(name, { selector: "strong" })).toBeInTheDocument();
    }
  });

  it("lists every case from evals/cases.ts, marking the critical ones", () => {
    render(<EvalPage />);
    const table = screen.getByRole("table", { name: "Eval cases" });
    expect(within(table).getAllByRole("row")).toHaveLength(CASES.length + 1);
    expect(within(table).getAllByText("Critical")).toHaveLength(
      CASES.filter((c) => c.critical).length,
    );
  });

  it("links to the FAQ page", () => {
    render(<EvalPage />);
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/docs/faq");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<EvalPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
