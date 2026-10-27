import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { SideNav } from "./SideNav";
import { COPY } from "@/lib/messages";
import { Routes } from "@/lib/routes";

let pathname = "/";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));

// jsdom loads no CSS, so "hidden on a phone" shows up as the `hidden` class that Tailwind turns
// into display:none. Whether it really is hidden is checked in a real browser (e2e/).
const button = () => screen.getByRole("button", { name: /menu/i });
const nav = () => screen.getByRole("navigation", { name: COPY.navLabel });
const collapsed = () => nav().classList.contains("hidden");

describe("SideNav", () => {
  beforeEach(() => {
    pathname = "/";
  });

  it("always renders every link, in order, so it can be a sidebar on large screens", () => {
    render(<SideNav />);
    const links = screen.getAllByRole("link").filter((l) => nav().contains(l));
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      [COPY.navParser, Routes.page("home")],
      [COPY.navRequirements, Routes.page("requirements")],
      [COPY.navDocs, Routes.page("docs")],
      [COPY.navTests, Routes.page("tests")],
    ]);
  });

  it("shows the app name and tagline, with the name linking home", () => {
    render(<SideNav />);
    expect(screen.getByRole("link", { name: COPY.appName })).toHaveAttribute(
      "href",
      Routes.page("home"),
    );
    expect(screen.getByText(COPY.tagline)).toBeInTheDocument();
  });

  it("starts collapsed on a phone and expands when the menu button is pressed", async () => {
    render(<SideNav />);
    expect(button()).toHaveAttribute("aria-expanded", "false");
    expect(collapsed()).toBe(true);

    await userEvent.click(button());
    expect(button()).toHaveAttribute("aria-expanded", "true");
    expect(collapsed()).toBe(false);
  });

  it("toggles closed when the button is pressed again", async () => {
    render(<SideNav />);
    await userEvent.click(button());
    await userEvent.click(button());
    expect(collapsed()).toBe(true);
    expect(button()).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the current page", () => {
    pathname = Routes.page("docs");
    render(<SideNav />);
    expect(screen.getByRole("link", { name: COPY.navDocs })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: COPY.navParser })).not.toHaveAttribute("aria-current");
  });

  it("closes on Escape and returns focus to the button", async () => {
    render(<SideNav />);
    await userEvent.click(button());
    await userEvent.keyboard("{Escape}");
    expect(collapsed()).toBe(true);
    expect(button()).toHaveFocus();
  });

  it("ignores keys other than Escape", async () => {
    render(<SideNav />);
    await userEvent.click(button());
    await userEvent.keyboard("a");
    expect(collapsed()).toBe(false);
  });

  it("collapses again after navigating to another page", async () => {
    const { rerender } = render(<SideNav />);
    await userEvent.click(button());
    pathname = Routes.page("docs");
    rerender(<SideNav />);
    expect(collapsed()).toBe(true);
    expect(button()).toHaveAttribute("aria-expanded", "false");
  });

  describe("documentation submenu", () => {
    const sections = () => screen.queryByRole("list", { name: COPY.navDocsSections });

    it("is hidden outside the documentation", () => {
      for (const page of ["home", "requirements", "tests"] as const) {
        pathname = Routes.page(page);
        const { unmount } = render(<SideNav />);
        expect(sections()).toBeNull();
        unmount();
      }
    });

    it("lists Setup, Eval and FAQ under Docs on every documentation page", () => {
      for (const page of ["docs", "docsEval", "docsFaq"] as const) {
        pathname = Routes.page(page);
        const { unmount } = render(<SideNav />);
        const links = within(sections()!).getAllByRole("link");
        expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
          [COPY.navDocsSetup, Routes.page("docs")],
          [COPY.navDocsEval, Routes.page("docsEval")],
          [COPY.navDocsFaq, Routes.page("docsFaq")],
        ]);
        unmount();
      }
    });

    it("sits inside the Docs item, between Docs and Tests", () => {
      pathname = Routes.page("docsEval");
      render(<SideNav />);
      const docsItem = screen.getByRole("link", { name: COPY.navDocs }).closest("li")!;
      expect(docsItem).toContainElement(sections());
      expect(docsItem.nextElementSibling).toHaveTextContent(COPY.navTests);
    });

    it("marks only the open section as current", () => {
      pathname = Routes.page("docsFaq");
      render(<SideNav />);
      expect(screen.getByRole("link", { name: COPY.navDocsFaq })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByRole("link", { name: COPY.navDocsEval })).not.toHaveAttribute(
        "aria-current",
      );
      expect(screen.getByRole("link", { name: COPY.navDocs })).not.toHaveAttribute("aria-current");
    });

    it("does not appear for a path that merely starts with the same letters", () => {
      pathname = "/docsandmore";
      render(<SideNav />);
      expect(sections()).toBeNull();
    });

    it("has no accessibility violations", async () => {
      pathname = Routes.page("docsEval");
      const { container } = render(<SideNav />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  it("has no accessibility violations, open or closed", async () => {
    const { container } = render(<SideNav />);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(button());
    expect(await axe(container)).toHaveNoViolations();
  });
});
