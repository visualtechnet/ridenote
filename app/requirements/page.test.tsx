import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { HTTP } from "@/lib/config";
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

  it("has no accessibility violations", async () => {
    const { container } = render(<RequirementsPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
