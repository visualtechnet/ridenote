import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Providers } from "./Providers";

function Probe() {
  // Throws if no QueryClientProvider is above this component.
  useQueryClient();
  return <p>child rendered</p>;
}

describe("Providers", () => {
  it("renders its children inside a React Query provider", () => {
    render(
      <Providers>
        <Probe />
      </Providers>,
    );
    expect(screen.getByText("child rendered")).toBeInTheDocument();
  });
});
