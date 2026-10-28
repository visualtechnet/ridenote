import { render, screen, within } from "@testing-library/react";
import { TripCard } from "./TripCard";
import { COPY } from "@/lib/messages";
import type { Trip } from "@/lib/trip";
import { makeTrip } from "../tests/test-utils";

const full: Trip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
  pickup_time: "09:30",
  mobility: ["wheelchair"],
  missing_fields: [],
  notes: "Confirm ramp access.",
};

describe("TripCard usage", () => {
  it("shows input tokens, output tokens and latency", () => {
    render(
      <TripCard trip={full} usage={{ inputTokens: 120, outputTokens: 160, latencyMs: 842 }} />,
    );
    expect(screen.getByText("120 in · 160 out · 842 ms")).toBeInTheDocument();
  });

  it("shows no usage line when there is no usage", () => {
    render(<TripCard trip={full} />);
    expect(screen.queryByText(COPY.usageLabel)).not.toBeInTheDocument();
  });
});

describe("TripCard", () => {
  it("shows every field with its label", () => {
    render(<TripCard trip={full} />);
    expect(screen.getByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeInTheDocument();
    expect(screen.getByText("Wheelchair")).toBeInTheDocument();
    expect(screen.getByText("Pickup")).toBeInTheDocument();
    expect(screen.getByText("12 Oak St")).toBeInTheDocument();
    expect(screen.getByText("County Hospital")).toBeInTheDocument();
    expect(screen.getByText("9:30 AM")).toBeInTheDocument();
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

  it("shows the pickup time in 12-hour form, with the exact 24-hour value for machines", () => {
    const { container } = render(<TripCard trip={{ ...full, pickup_time: "16:15" }} />);
    const time = container.querySelector("time")!;
    expect(time).toHaveTextContent("4:15 PM");
    expect(time).toHaveAttribute("datetime", "16:15");
  });

  describe("mobility", () => {
    it("lists every aid, in the order given", () => {
      render(<TripCard trip={{ ...full, mobility: ["wheelchair", "cane", "walker"] }} />);
      const list = screen.getByRole("list", { name: "Mobility" });
      const items = within(list).getAllByRole("listitem");
      expect(items.map((i) => i.textContent)).toEqual(["Wheelchair", "Cane", "Walker"]);
    });

    it("says 'Not stated' when the list is empty, rather than showing nothing", () => {
      render(<TripCard trip={makeTrip({ mobility: [] })} />);
      expect(screen.queryByRole("list", { name: "Mobility" })).not.toBeInTheDocument();
      expect(screen.getAllByText("Not stated")).toHaveLength(1);
    });

    it("asks for a check with a quiet line, not an amber chip, when mobility is not stated", () => {
      render(<TripCard trip={makeTrip({ mobility: [] })} />);
      expect(screen.getByText(COPY.confirmMobility)).toBeInTheDocument();
      // Nothing else is missing, so there is no Missing list at all.
      expect(screen.queryByRole("list", { name: "Missing fields" })).not.toBeInTheDocument();
    });

    it("keeps mobility out of the Missing chips even when other fields are missing", () => {
      render(<TripCard trip={makeTrip({ mobility: [], pickup_time: null })} />);
      const list = screen.getByRole("list", { name: "Missing fields" });
      expect(list).toHaveTextContent("pickup_time");
      expect(list).not.toHaveTextContent("mobility");
      expect(screen.getByText(COPY.confirmMobility)).toBeInTheDocument();
    });

    it("shows no check line when an aid is named", () => {
      render(<TripCard trip={makeTrip({ mobility: ["cane"] })} />);
      expect(screen.queryByText(COPY.confirmMobility)).not.toBeInTheDocument();
    });

    it("shows an unaided walker plainly", () => {
      render(<TripCard trip={{ ...full, mobility: ["ambulatory"] }} />);
      expect(screen.getByText("Walks unaided")).toBeInTheDocument();
    });
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
