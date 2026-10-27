import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import Home from "@/app/page";
import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";
import { render } from "@testing-library/react";
import { renderWithProviders, reply } from "./test-utils";

// jsdom cannot compute colours, so contrast is covered by the Playwright + axe tests in e2e/.
describe("accessibility (axe)", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("home page, idle", async () => {
    const { container } = renderWithProviders(<Home />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("home page, showing a validation error", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<Home />);
    await user.click(screen.getByRole("button", { name: "Parse" }));
    await screen.findByText(/please enter a dispatcher note/i);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("home page, showing a result", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      reply({
        trip: {
          passenger_name: "Mrs. Lee",
          pickup_location: "12 Oak St",
          dropoff_location: null,
          pickup_time: "09:30",
          mobility: "wheelchair",
          missing_fields: ["dropoff_location"],
          notes: "Confirm ramp.",
        },
      }),
    ) as unknown as typeof fetch;
    const user = userEvent.setup();
    const { container } = renderWithProviders(<Home />);
    await user.click(screen.getByRole("button", { name: /use an example/i }));
    await user.click(screen.getByRole("button", { name: "Parse" }));
    await screen.findByRole("heading", { level: 2, name: "Mrs. Lee" });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("home page, showing a server error", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(reply({ error: "Nope" }, 502)) as unknown as typeof fetch;
    const user = userEvent.setup();
    const { container } = renderWithProviders(<Home />);
    await user.click(screen.getByRole("button", { name: /use an example/i }));
    await user.click(screen.getByRole("button", { name: "Parse" }));
    await screen.findByRole("alert");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("error page", async () => {
    const { container } = render(<ErrorPage error={new Error("x")} retry={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("not-found page", async () => {
    const { container } = render(<NotFound />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
