import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { AGENT, HTTP } from "@/lib/config";
import { UsageSchema } from "@/lib/usage";
import RequirementsPage from "./page";

describe("Requirements page", () => {
  it("has the PRD, input, output, JSON and success sections", () => {
    render(<RequirementsPage />);
    for (const name of [
      /product requirements/i,
      /required input/i,
      /expected output/i,
      /what is valid json/i,
      /what makes a parse succeed/i,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("states the time rules: 24-hour in the data, 12-hour only on screen, no time zones", () => {
    const { container } = render(<RequirementsPage />);
    expect(screen.getByRole("heading", { name: "Time rules" })).toBeInTheDocument();
    const text = container.textContent ?? "";
    expect(text).toMatch(/always 24-hour/);
    expect(text).toMatch(/Only the display changes/);
    expect(text).toMatch(/No time zones/);
    expect(text).toMatch(/never\s+converted to the server/);
    expect(text).toMatch(/Time zones\. Whatever time the note gives is kept as is/); // out of scope list
  });

  it("lists every status the API can return for a parse", () => {
    const { container } = render(<RequirementsPage />);
    const text = container.textContent ?? "";
    for (const status of [
      HTTP.badRequest,
      HTTP.payloadTooLarge,
      HTTP.unsupportedMediaType,
      HTTP.unprocessable,
      HTTP.tooManyRequests,
      HTTP.badGateway,
      HTTP.unavailable,
    ]) {
      expect(text).toContain(`${status} `);
    }
  });

  it("shows sample JSON output with all seven keys", () => {
    const { container } = render(<RequirementsPage />);
    for (const key of [
      "passenger_name",
      "pickup_location",
      "dropoff_location",
      "pickup_time",
      "mobility",
      "missing_fields",
      "notes",
    ]) {
      expect(container.querySelector("pre")?.textContent ?? "").toBeDefined();
      expect(container.textContent).toContain(`"${key}"`);
    }
  });

  it("lists the agent requirements TC-1 to TC-10 and AL-1 to AL-15, each once", () => {
    render(<RequirementsPage />);
    expect(screen.getByRole("heading", { level: 2, name: "The agent" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Agent requirements" });
    const ids = [
      ...Array.from({ length: 10 }, (_, i) => `TC-${i + 1}`),
      ...Array.from({ length: 15 }, (_, i) => `AL-${i + 1}`),
    ];
    const found = within(table)
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent);
    expect(found).toEqual(ids);
    // The ids are not repeated anywhere else on the page.
    for (const id of ids) {
      expect(screen.getAllByText(id, { exact: true })).toHaveLength(1);
    }
  });

  it("renders the agent run limits from the config", () => {
    render(<RequirementsPage />);
    const row = screen.getByRole("rowheader", { name: "AL-3" }).closest("tr") as HTMLElement;
    const text = row.textContent ?? "";
    expect(text).toContain(`${AGENT.maxSteps} steps`);
    expect(text).toContain(`${AGENT.maxRunTokens.toLocaleString("en-US")} tokens`);
    expect(text).toContain(`${AGENT.maxStepTokens} output tokens`);
    expect(text).toContain(`${AGENT.deadlineMs / 1000} seconds`);
  });

  it("links the agent section to the agent guide for what is built, and claims no status", () => {
    render(<RequirementsPage />);
    const link = screen.getByRole("link", { name: /what is built and what is not yet/i });
    expect(link).toHaveAttribute("href", "/docs/agent");
    expect(screen.queryByRole("columnheader", { name: /status|built|tested/i })).toBeNull();
    expect(screen.getByRole("link", { name: "The agent" })).toHaveAttribute("href", "#agent");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<RequirementsPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Requirements page usage", () => {
  it("documents the usage object that comes back with a successful parse", () => {
    const { container } = render(<RequirementsPage />);
    for (const key of Object.keys(UsageSchema.shape)) expect(container.textContent).toContain(key);
  });
});
