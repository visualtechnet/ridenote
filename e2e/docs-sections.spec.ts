import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { CASES } from "../evals/cases";
import { Routes } from "../lib/routes";

const mainNav = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Main" });
const submenu = (page: import("@playwright/test").Page) =>
  page.getByRole("list", { name: "Documentation sections" });

test.describe("documentation sections", () => {
  test("the submenu is absent elsewhere and appears under Docs, with Setup, Eval and FAQ", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(Routes.page("home"));
    await expect(submenu(page)).toHaveCount(0);

    await mainNav(page).getByRole("link", { name: "Docs", exact: true }).click();
    await expect(page).toHaveURL(Routes.page("docs"));
    await expect(submenu(page).getByRole("link")).toHaveText(["Setup", "Eval", "FAQ"]);
  });

  test("each section opens its page and is marked current", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(Routes.page("docs"));

    await submenu(page).getByRole("link", { name: "Eval" }).click();
    await expect(page).toHaveURL(Routes.page("docsEval"));
    await expect(page.getByRole("heading", { level: 1, name: "Eval" })).toBeVisible();
    await expect(submenu(page).getByRole("link", { name: "Eval" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await submenu(page).getByRole("link", { name: "FAQ" }).click();
    await expect(page).toHaveURL(Routes.page("docsFaq"));
    await expect(
      page.getByRole("heading", { level: 1, name: "FAQ and key learnings" }),
    ).toBeVisible();

    await submenu(page).getByRole("link", { name: "Setup" }).click();
    await expect(page).toHaveURL(Routes.page("docs"));
    await expect(page.getByRole("heading", { level: 1, name: "Documentation" })).toBeVisible();
  });

  test("the Setup page points to the other two sections", async ({ page }) => {
    await page.goto(Routes.page("docs"));
    await page.locator("main").getByRole("link", { name: "Eval" }).click();
    await expect(page).toHaveURL(Routes.page("docsEval"));
    await page.locator("main").getByRole("link", { name: "FAQ" }).click();
    await expect(page).toHaveURL(Routes.page("docsFaq"));
  });

  test("the Eval page lists every case, and links to the FAQ", async ({ page }) => {
    await page.goto(Routes.page("docsEval"));
    await expect(page.getByRole("table", { name: "Eval cases" }).getByRole("row")).toHaveCount(
      CASES.length + 1,
    );
    await page.locator("main").getByRole("link", { name: "FAQ" }).click();
    await expect(page).toHaveURL(Routes.page("docsFaq"));
  });

  test("the FAQ shows the lessons, and its contents links jump to their headings", async ({
    page,
  }) => {
    await page.goto(Routes.page("docsFaq"));
    await expect(page.getByRole("heading", { name: /pasted emails were refused/i })).toBeVisible();
    await page
      .locator("main")
      .getByRole("link", { name: /Mistakes and bugs, and what they taught us/ })
      .click();
    await expect(page).toHaveURL(/#part-2-mistakes-and-bugs-and-what-they-taught-us$/);
    await expect(page.getByRole("heading", { level: 2, name: /^Part 2/ })).toBeInViewport();
  });

  test("on a phone the submenu is inside the Menu on documentation pages", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(Routes.page("docsEval"));
    await expect(submenu(page)).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(submenu(page).getByRole("link")).toHaveText(["Setup", "Eval", "FAQ"]);
    await submenu(page).getByRole("link", { name: "FAQ" }).click();
    await expect(page).toHaveURL(Routes.page("docsFaq"));
    await expect(mainNav(page)).toBeHidden();
  });

  test("an unknown page under /docs is still a 404", async ({ page }) => {
    const res = await page.goto("/docs/nope");
    expect(res?.status()).toBe(404);
  });

  for (const scheme of ["light", "dark"] as const) {
    for (const route of [Routes.page("docsEval"), Routes.page("docsFaq")]) {
      test(`${route} has no accessibility violations in ${scheme} mode`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(route);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }

  test("neither page overflows sideways on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const route of [Routes.page("docsEval"), Routes.page("docsFaq")]) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });
});
