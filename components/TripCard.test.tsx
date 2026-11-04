import { render, screen, within } from "@testing-library/react";
import { TripCard } from "./TripCard";
import { COPY } from "@/lib/messages";
import type { Trip } from "@/lib/trip";
import { makeTrip } from "../tests/test-utils";

const full: Trip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
  pickup_date: null,
  pickup_time: "09:30",
  mobility: ["wheelchair"],
  missing_fields: [],
  notes: "Confirm ramp access.",
};

describe("TripCard usage", () => {
  it("shows input tokens, output tokens and latency behind a Usage toggle, closed by default", () => {
    render(
      <TripCard trip={full} usage={{ inputTokens: 120, outputTokens: 160, latencyMs: 842 }} />,
    );
    expect(screen.getByText("120 in · 160 out · 842 ms")).toBeInTheDocument();
    const details = screen.getByText(COPY.usageLabel).closest("details")!;
    expect(details).not.toHaveAttribute("open");
  });

  it("keeps the verify reminder after the usage toggle, as the last line of the card", () => {
    const { container } = render(
      <TripCard trip={full} usage={{ inputTokens: 120, outputTokens: 160, latencyMs: 842 }} />,
    );
    const texts = [...container.querySelectorAll("details, p")].map((el) => el.textContent);
    expect(texts.at(-1)).toBe(COPY.verifyReminder);
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
    expect(screen.getAllByText("Not stated")).toHaveLength(4);
  });

  describe("pickup date", () => {
    it("shows the date as a readable day, with the exact date for machines", () => {
      const { container } = render(<TripCard trip={{ ...full, pickup_date: "2026-11-06" }} />);
      expect(screen.getByText("Pickup date")).toBeInTheDocument();
      const date = container.querySelector('time[datetime="2026-11-06"]')!;
      expect(date).toHaveTextContent("Fri, Nov 6, 2026");
      expect(screen.queryByText(COPY.confirmDate)).not.toBeInTheDocument();
    });

    it("asks for a check with a quiet line, not a Missing chip, when the date is not stated", () => {
      render(<TripCard trip={makeTrip({ pickup_date: null })} />);
      expect(screen.getByText(COPY.confirmDate)).toBeInTheDocument();
      // Most notes give no date, so it is never a chip: a chip on nearly every card would be ignored.
      expect(screen.queryByRole("list", { name: "Missing fields" })).not.toBeInTheDocument();
    });

    it("shows the server's reason for clearing the date under the date field, and the rest of the note on its own", () => {
      const reason = "Date Thu, Oct 1, 2026 has already passed; confirm the date.";
      render(
        <TripCard trip={makeTrip({ pickup_date: null, notes: `${reason} Approximate time.` })} />,
      );
      expect(screen.getByText(reason)).toBeInTheDocument();
      expect(screen.queryByText(COPY.confirmDate)).not.toBeInTheDocument();
      expect(screen.getByText("Approximate time.")).toBeInTheDocument();
      expect(screen.queryByText(`${reason} Approximate time.`)).not.toBeInTheDocument();
    });

    it("keeps the date out of the Missing chips even when other fields are missing", () => {
      render(<TripCard trip={makeTrip({ pickup_date: null, pickup_time: null })} />);
      const list = screen.getByRole("list", { name: "Missing fields" });
      expect(list).toHaveTextContent("Pickup time");
      expect(list).not.toHaveTextContent(/date/i);
    });
  });

  it("shows the pickup time in 12-hour form, with the exact 24-hour value for machines", () => {
    const { container } = render(<TripCard trip={{ ...full, pickup_time: "16:15" }} />);
    const time = container.querySelector('time[datetime="16:15"]')!;
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
      // Mobility and the (undated) pickup date.
      expect(screen.getAllByText("Not stated")).toHaveLength(2);
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
      expect(list).toHaveTextContent("Pickup time");
      expect(list).not.toHaveTextContent(/mobility/i);
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

  it("lists missing fields as chips with readable names, never raw keys", () => {
    render(<TripCard trip={{ ...full, missing_fields: ["pickup_time", "dropoff_location"] }} />);
    const list = screen.getByRole("list", { name: "Missing fields" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(["Pickup time", "Dropoff"]);
    expect(list).not.toHaveTextContent("_");
  });

  describe("inline hints (one rule for every blank)", () => {
    it("puts a confirm line under each missing pickup, dropoff and time", () => {
      render(
        <TripCard
          trip={{
            ...full,
            pickup_location: null,
            dropoff_location: null,
            pickup_time: null,
            missing_fields: ["pickup_location", "dropoff_location", "pickup_time"],
          }}
        />,
      );
      expect(screen.getByText(COPY.confirmField("Pickup"))).toBeInTheDocument();
      expect(screen.getByText(COPY.confirmField("Dropoff"))).toBeInTheDocument();
      expect(screen.getByText(COPY.confirmField("Pickup time"))).toBeInTheDocument();
    });

    it("puts a confirm line under the heading when the passenger is missing", () => {
      render(
        <TripCard trip={{ ...full, passenger_name: null, missing_fields: ["passenger_name"] }} />,
      );
      expect(screen.getByText(COPY.confirmField("Passenger"))).toBeInTheDocument();
    });

    it("shows no confirm line for a field that is present", () => {
      render(<TripCard trip={{ ...full, pickup_date: "2026-11-06" }} />);
      expect(screen.queryByText(/confirm before dispatching/i)).not.toBeInTheDocument();
    });

    it("labels the parser's note so it is not mistaken for part of the trip", () => {
      render(<TripCard trip={full} />);
      expect(screen.getByText(COPY.notesLabel)).toBeInTheDocument();
      expect(screen.getByText("Confirm ramp access.")).toBeInTheDocument();
    });
  });

  describe("out of date", () => {
    it("tags and outlines the card when the note has changed since it was parsed", () => {
      render(<TripCard trip={full} stale />);
      expect(screen.getByText(COPY.staleTag)).toBeInTheDocument();
      expect(screen.getByRole("region", { name: COPY.resultLabel })).toHaveAttribute("data-stale");
      // The heading still reads as the passenger's name, with the tag as part of it.
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/Mrs\. Lee/);
    });

    it("shows no tag on a current card", () => {
      render(<TripCard trip={full} />);
      expect(screen.queryByText(COPY.staleTag)).not.toBeInTheDocument();
      expect(screen.getByRole("region", { name: COPY.resultLabel })).not.toHaveAttribute(
        "data-stale",
      );
    });
  });

  it("offers to copy the trip as text, so the card has a path into a scheduling system", () => {
    render(<TripCard trip={full} />);
    expect(screen.getByRole("button", { name: COPY.copyTrip })).toBeInTheDocument();
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
