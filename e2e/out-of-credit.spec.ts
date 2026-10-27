import { expect, test } from "@playwright/test";
import { MESSAGES } from "../lib/messages";
import { Routes } from "../lib/routes";
import { mockParseApi } from "./fixtures";

test.describe("when the demo's AI credit is used up", () => {
  test("the page says so plainly, keeps the note, and points to the setup guide", async ({
    page,
  }) => {
    await mockParseApi(page, { error: MESSAGES.outOfCredit, code: "out_of_credit" }, 503);
    await page.goto(Routes.page("home"));
    const note = page.getByRole("textbox", { name: "Dispatcher note" });
    await note.fill("Pick up Mrs. Lee at 12 Oak St at 9:30am, to County Hospital");
    await page.getByRole("button", { name: "Parse" }).click();

    await expect(page.locator("main").getByRole("alert")).toHaveText(MESSAGES.outOfCredit);
    await expect(page.getByRole("region", { name: "Parsed trip" })).toHaveCount(0);
    await expect(note).toHaveValue(/Mrs\. Lee/);
    await expect(page.getByRole("button", { name: "Parse" })).toBeEnabled();
  });

  test("the setup guide explains how to get a key and how to share a demo", async ({ page }) => {
    await page.goto(Routes.page("docs"));
    await expect(page.getByRole("heading", { level: 2, name: "Getting an API key" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Sharing or deploying a demo" }),
    ).toBeVisible();
    await page.locator("main").getByRole("link", { name: "Getting an API key" }).first().click();
    await expect(page).toHaveURL(/#api-key$/);
    await expect(page.locator("main")).not.toContainText(/sk-ant-[A-Za-z0-9]{8,}/);
  });
});
