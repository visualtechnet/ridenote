import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { CONTACT } from "@/lib/config";
import ContactPage from "./page";

describe("Contact page", () => {
  it("has one h1 and sections for the demo and for running it yourself", () => {
    render(<ContactPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "The public demo" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Run it yourself with your own key" }),
    ).toBeInTheDocument();
  });

  it("links GitHub issues for questions and feedback, and shows no email address", () => {
    const { container } = render(<ContactPage />);
    expect(screen.getByRole("link", { name: CONTACT.label })).toHaveAttribute("href", CONTACT.url);
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(container.textContent).not.toMatch(/\S+@\S+\.\S+/);
  });

  it("says keys are not provided, and does not offer to send one", () => {
    const { container } = render(<ContactPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/API keys are not provided or shared/);
    expect(text).not.toMatch(/request a (temporary )?key|ask for a (temporary )?key/i);
  });

  it("says the demo's budget is small, shared and not raised, without printing a dollar amount", () => {
    const { container } = render(<ContactPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/small, fixed budget shared by everyone/);
    expect(text).toMatch(/not raised/);
    expect(text).not.toMatch(/\$\s?\d/);
  });

  it("tells visitors to run it with their own key, with the .env.local steps", () => {
    const { container } = render(<ContactPage />);
    expect(container.textContent).toMatch(/need your own Anthropic API key/);
    expect(container.textContent).toContain(".env.local");
    expect(container.textContent).toContain("ANTHROPIC_API_KEY=");
  });

  it("points to the setup guide", () => {
    render(<ContactPage />);
    expect(screen.getByRole("link", { name: /setup guide/i })).toHaveAttribute("href", "/docs");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ContactPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
