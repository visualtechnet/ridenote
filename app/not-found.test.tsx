import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";
import { Routes } from "@/lib/routes";

describe("not-found page", () => {
  it("explains the problem and links back home using the shared route helper", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the parser" })).toHaveAttribute(
      "href",
      Routes.page("home"),
    );
  });
});
