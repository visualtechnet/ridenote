import { render, screen } from "@testing-library/react";
import { ResultPanel } from "./ResultPanel";
import type { Trip } from "@/lib/trip";

const trip: Trip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
  pickup_time: "09:30",
  mobility: ["wheelchair"],
  missing_fields: [],
  notes: "",
};

describe("ResultPanel", () => {
  it("renders nothing visible when idle", () => {
    render(<ResultPanel pending={false} error={null} trip={undefined} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows a loading placeholder and marks the region busy while pending", () => {
    render(<ResultPanel pending error={null} trip={undefined} />);
    expect(screen.getByRole("status", { name: "Parsing note" })).toBeInTheDocument();
    expect(screen.getByTestId("result-region")).toHaveAttribute("aria-busy", "true");
  });

  it("shows the trip as a card", () => {
    render(<ResultPanel pending={false} error={null} trip={trip} />);
    expect(screen.getByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeInTheDocument();
  });

  it("shows an error as an alert outside the live region", () => {
    render(<ResultPanel pending={false} error="Something broke" trip={undefined} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something broke");
    expect(screen.getByTestId("result-region")).not.toContainElement(alert);
  });

  it("warns when the shown result is for an older version of the note", () => {
    render(<ResultPanel pending={false} error={null} trip={trip} stale />);
    expect(screen.getByText(/note has changed since this was parsed/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeInTheDocument();
  });

  it("does not warn when the result matches the note", () => {
    render(<ResultPanel pending={false} error={null} trip={trip} />);
    expect(screen.queryByText(/note has changed/i)).not.toBeInTheDocument();
  });
});
