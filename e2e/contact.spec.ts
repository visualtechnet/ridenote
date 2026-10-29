import { expect, test } from "@playwright/test";
import { CONTACT } from "../lib/config";
import { MESSAGES } from "../lib/messages";
import { Routes } from "../lib/routes";
import { mockParseApi } from "./fixtures";

test.describe("contact", () => {
  test("the Contact item opens a page with the GitHub issues link and the key request", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(Routes.page("home"));
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Contact" })
      .click();
    await expect(page).toHaveURL(Routes.page("contact"));
    await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
    const issues = page.getByRole("main").getByRole("link", { name: CONTACT.label, exact: true });
    await expect(issues).toHaveAttribute("href", CONTACT.url);
    await expect(page.getByRole("main")).toContainText("API keys are not provided or shared");
  });

  test("on a phone the Contact item is inside the Menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(Routes.page("home"));
    await page.getByRole("button", { name: "Menu" }).click();
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Contact" })
      .click();
    await expect(page).toHaveURL(Routes.page("contact"));
  });

  test("when the demo budget is used up, the message tells visitors to run it with their own key", async ({
    page,
  }) => {
    await mockParseApi(page, { error: MESSAGES.outOfCredit, code: "out_of_credit" }, 503);
    await page.goto(Routes.page("home"));
    await page
      .getByRole("textbox", { name: "Dispatcher note" })
      .fill("Pick up Mrs. Lee at 12 Oak St at 9:30am, to County Hospital");
    await page.getByRole("button", { name: "Parse" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("your own API key");
  });
});
