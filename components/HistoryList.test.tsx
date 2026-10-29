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

const withUsage = (id: number, tokens: number, latencyMs: number) =>
  row({ id, input_tokens: tokens - 100, output_tokens: 100, latency_ms: latencyMs });

describe("HistoryList usage", () => {
  it("shows each call's tokens and latency, and nothing for older rows", () => {
    render(<HistoryList rows={[withUsage(1, 300, 800), row({ id: 2 })]} />);
    const [first, second] = screen.getAllByRole("article");
    expect(within(first).getByText("200 in · 100 out · 800 ms")).toBeInTheDocument();
    expect(within(second).queryByText(COPY.usageLabel)).not.toBeInTheDocument();
  });

  it("labels the most efficient and the most problematic calls against the rest", () => {
    const rows = [
      withUsage(1, 300, 800),
      withUsage(2, 400, 1000),
      withUsage(3, 500, 1200),
      withUsage(4, 400, 900),
      withUsage(5, 400, 1100),
      withUsage(6, 900, 900),
    ];
    render(<HistoryList rows={rows} />);
    const entries = screen.getAllByRole("article");
    expect(within(entries[0]).getByText(COPY.ratingEfficient)).toBeInTheDocument();
    expect(within(entries[5]).getByText(COPY.ratingProblematic)).toBeInTheDocument();
    expect(within(entries[2]).queryByText(COPY.ratingEfficient)).not.toBeInTheDocument();
    expect(screen.getByText(/median/i)).toBeInTheDocument();
  });

  it("shows no ratings with fewer than five rows that have usage", () => {
    render(<HistoryList rows={[withUsage(1, 300, 800), withUsage(2, 900, 5000)]} />);
    expect(screen.queryByText(COPY.ratingProblematic)).not.toBeInTheDocument();
    expect(screen.queryByText(/median/i)).not.toBeInTheDocument();
  });
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
