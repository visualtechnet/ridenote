import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { COPY } from "@/lib/messages";
import type { HistoryRow } from "@/lib/history";
import { HistoryList } from "./HistoryList";

const row = (over: Partial<HistoryRow> = {}): HistoryRow => ({
  id: 1,
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
  pickup_time: "16:15",
  mobility: ["wheelchair", "walker"],
  created_at: new Date("2026-10-27T14:05:00Z"),
  ...over,
});

describe("HistoryList", () => {
  it("lists the rows in the order given, with every field", () => {
    render(<HistoryList rows={[row({ id: 2, passenger_name: "Second" }), row()]} />);
    const entries = screen.getAllByRole("article");
    expect(entries.map((e) => within(e).getByRole("heading").textContent)).toEqual([
      "Second",
      "Mrs. Lee",
    ]);
    const first = within(entries[1]);
    expect(first.getByText("12 Oak St")).toBeInTheDocument();
    expect(first.getByText("County Hospital")).toBeInTheDocument();
    expect(first.getByText("4:15 PM")).toBeInTheDocument();
    expect(first.getByText("Wheelchair")).toBeInTheDocument();
    expect(first.getByText("Walker")).toBeInTheDocument();
    const saved = first.getByText(/Oct 27, 2026/);
    expect(saved.tagName).toBe("TIME");
    expect(saved).toHaveAttribute("datetime", "2026-10-27T14:05:00.000Z");
  });

  it("shows Not stated for every empty field", () => {
    render(
      <HistoryList
        rows={[
          row({
            passenger_name: null,
            pickup_location: null,
            dropoff_location: null,
            pickup_time: null,
            mobility: [],
          }),
        ]}
      />,
    );
    expect(screen.getByRole("heading").textContent).toBe(COPY.unknownPassenger);
    expect(screen.getAllByText(COPY.notStated)).toHaveLength(4);
  });

  it("renders hostile and very long text as plain text", () => {
    const evil = "<img src=x onerror=alert(1)>";
    const long = "A".repeat(300);
    const { container } = render(
      <HistoryList rows={[row({ passenger_name: evil, pickup_location: long })]} />,
    );
    expect(screen.getByRole("heading").textContent).toBe(evil);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(long)).toHaveClass("break-words");
  });

  it("has nothing that changes anything", () => {
    const { container } = render(<HistoryList rows={[row()]} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<HistoryList rows={[row(), row({ id: 2, mobility: [] })]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
