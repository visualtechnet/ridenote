import { render, screen } from "@testing-library/react";
import { TripCard } from "./TripCard";
import type { Trip } from "@/lib/trip";

const full: Trip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
  pickup_time: "09:30",
  mobility: "wheelchair",
  missing_fields: [],
  notes: "Confirm ramp access.",
};

describe("TripCard", () => {
  it("shows every field with its label", () => {
    render(<TripCard trip={full} />);
    expect(screen.getByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeInTheDocument();
    expect(screen.getByText("wheelchair")).toBeInTheDocument();
    expect(screen.getByText("Pickup")).toBeInTheDocument();
    expect(screen.getByText("12 Oak St")).toBeInTheDocument();
    expect(screen.getByText("County Hospital")).toBeInTheDocument();
    expect(screen.getByText("09:30")).toBeInTheDocument();
    expect(screen.getByText("Confirm ramp access.")).toBeInTheDocument();
  });

  it("says 'Not stated' for null fields and 'Unknown passenger' for a null name", () => {
    render(
      <TripCard
        trip={{
          ...full,
          passenger_name: null,
          pickup_location: null,
          dropoff_location: null,
          pickup_time: null,
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Unknown passenger" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Not stated")).toHaveLength(3);
  });

  it("lists missing fields as text chips", () => {
    render(<TripCard trip={{ ...full, missing_fields: ["pickup_time", "dropoff_location"] }} />);
    const list = screen.getByRole("list", { name: "Missing fields" });
    expect(list).toHaveTextContent("pickup_time");
    expect(list).toHaveTextContent("dropoff_location");
  });

  it("reminds the dispatcher the data is AI-extracted", () => {
    render(<TripCard trip={full} />);
    expect(screen.getByText(/verify/i)).toBeInTheDocument();
  });

  it("omits the missing-fields list when nothing is missing", () => {
    render(<TripCard trip={full} />);
    expect(screen.queryByRole("list", { name: "Missing fields" })).not.toBeInTheDocument();
  });

  it("renders model output as text, never as HTML", () => {
    const evil = '<img src=x onerror="alert(1)">';
    const { container } = render(
      <TripCard trip={{ ...full, pickup_location: evil, notes: evil }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByText(evil).length).toBeGreaterThan(0);
  });
});
