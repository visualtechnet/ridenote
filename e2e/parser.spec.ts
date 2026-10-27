import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { MESSAGES } from "../lib/messages";
import { Routes } from "../lib/routes";
import { mockParseApi, trip } from "./fixtures";

const note = (page: import("@playwright/test").Page) =>
  page.getByRole("textbox", { name: "Dispatcher note" });

test.describe("happy path", () => {
  test("a dispatcher pastes a note and sees the trip as a card", async ({ page }) => {
    const calls = await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));

    await note(page).fill(
      "  Pick up Mrs. Lee at 12 Oak St at 9:30am, to County Hospital, wheelchair  ",
    );
    await page.getByRole("button", { name: "Parse" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeVisible();
    const card = page.getByRole("region", { name: "Parsed trip" });
    await expect(card.getByText("12 Oak St")).toBeVisible();
    await expect(card.getByText("County Hospital")).toBeVisible();
    await expect(card.getByText("9:30 AM")).toBeVisible();
    await expect(card.getByText("Wheelchair")).toBeVisible();
    await expect(card.getByText(/verify before dispatching/i)).toBeVisible();
    // A card, not raw JSON:
    await expect(page.locator("body")).not.toContainText('"passenger_name"');
    expect(calls).toEqual([
      { note: "Pick up Mrs. Lee at 12 Oak St at 9:30am, to County Hospital, wheelchair" },
    ]);
  });

  test("the example button fills the box and the result can be cleared", async ({ page }) => {
    await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));
    await page.getByRole("button", { name: "Use an example" }).click();
    await expect(note(page)).not.toHaveValue("");
    await page.getByRole("button", { name: "Parse" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeVisible();

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(note(page)).toHaveValue("");
    await expect(note(page)).toBeFocused();
    await expect(page.getByRole("region", { name: "Parsed trip" })).toHaveCount(0);
  });
});

test.describe("validation and security", () => {
  test("clicking Parse on an empty box explains what to do and sends nothing", async ({ page }) => {
    const calls = await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));
    await page.getByRole("button", { name: "Parse" }).click();
    await expect(page.getByText(MESSAGES.noteRequired)).toBeVisible();
    await expect(note(page)).toBeFocused();
    expect(calls).toHaveLength(0);
  });

  for (const payload of [
    "<script>window.__xss = 1</script>",
    '<img src=x onerror="window.__xss = 1">',
    "<svg/onload=window.__xss=1>",
    "javascript:window.__xss=1",
  ]) {
    test(`script injection is blocked with a friendly message: ${payload}`, async ({ page }) => {
      const calls = await mockParseApi(page, { trip });
      let dialogOpened = false;
      page.on("dialog", (d) => {
        dialogOpened = true;
        void d.dismiss();
      });
      await page.goto(Routes.page("home"));

      await note(page).fill(payload);
      await page.getByRole("button", { name: "Parse" }).click();

      await expect(page.getByText(MESSAGES.noteMarkup)).toBeVisible();
      expect(calls).toHaveLength(0);
      expect(dialogOpened).toBe(false);
      expect(
        await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
      ).toBeUndefined();
    });
  }

  test("hostile text coming back from the server is shown as plain text and never runs", async ({
    page,
  }) => {
    const hostile = '<img src=x onerror="window.__xss = 1">';
    await mockParseApi(page, {
      trip: { ...trip, passenger_name: hostile, notes: "<script>window.__xss=1</script>" },
    });
    let dialogOpened = false;
    page.on("dialog", () => (dialogOpened = true));
    await page.goto(Routes.page("home"));

    await note(page).fill("Pick up Mrs. Lee at 12 Oak St");
    await page.getByRole("button", { name: "Parse" }).click();

    await expect(page.getByRole("heading", { level: 2, name: hostile })).toBeVisible();
    await expect(page.locator("main img")).toHaveCount(0);
    expect(dialogOpened).toBe(false);
    expect(
      await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
    ).toBeUndefined();
  });

  test("the real API route rejects bad input with friendly JSON, before any paid call", async ({
    request,
  }) => {
    const bad = await request.post(Routes.api("parse"), {
      data: Buffer.from("{not json"),
      headers: { "content-type": "application/json" },
    });
    expect(bad.status()).toBe(400);

    const xss = await request.post(Routes.api("parse"), {
      data: { note: "<script>alert(1)</script>" },
    });
    expect(xss.status()).toBe(400);
    expect((await xss.json()).error).toBe(MESSAGES.noteMarkup);

    const bareString = await request.post(Routes.api("parse"), {
      data: Buffer.from('"Pick up Mrs. Lee at 12 Oak St"'),
      headers: { "content-type": "application/json" },
    });
    expect(bareString.status()).toBe(400);

    const empty = await request.post(Routes.api("parse"), { data: { note: "" } });
    expect(empty.status()).toBe(400);
    expect(xss.headers()["cache-control"]).toBe("no-store");
  });

  test("security headers are sent", async ({ request }) => {
    const res = await request.get(Routes.page("home"));
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});

test.describe("errors", () => {
  test("a server error shows a friendly alert and the page stays usable", async ({ page }) => {
    await mockParseApi(page, { error: MESSAGES.parseFailed }, 502);
    await page.goto(Routes.page("home"));
    await note(page).fill("Pick up Mrs. Lee at 12 Oak St");
    await page.getByRole("button", { name: "Parse" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(MESSAGES.parseFailed);
    await expect(page.getByRole("button", { name: "Parse" })).toBeEnabled();
  });

  test("an unknown URL shows the 404 page with a way back", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to the parser" }).click();
    await expect(page).toHaveURL(Routes.page("home"));
  });
});

test.describe("usability", () => {
  test("works with the keyboard alone", async ({ page }) => {
    const calls = await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));

    await page.keyboard.press("Tab"); // skip link comes first
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.keyboard.press("Enter"); // the skip link jumps past the navigation...
    await page.keyboard.press("Tab");
    await expect(note(page)).toBeFocused(); // ...so the next Tab lands on the note

    await page.keyboard.type("Pick up Mrs. Lee at 12 Oak St");
    await page.keyboard.press("Control+Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeVisible();
    expect(calls).toHaveLength(1);
  });

  test("shows a loading state while waiting and blocks double submits", async ({ page }) => {
    let calls = 0;
    await page.route(`**${Routes.api("parse")}`, async (route) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 600));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ trip }),
      });
    });
    await page.goto(Routes.page("home"));
    await note(page).fill("Pick up Mrs. Lee at 12 Oak St");
    await page.getByRole("button", { name: "Parse" }).click();
    await expect(page.getByRole("button", { name: "Parsing…" })).toBeDisabled();
    await expect(page.getByRole("status", { name: "Parsing note" })).toBeVisible();
    await page.keyboard.press("Control+Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeVisible();
    expect(calls).toBe(1);
  });

  for (const width of [320, 768, 1440]) {
    test(`no horizontal scrolling at ${width}px wide`, async ({ page }) => {
      await mockParseApi(page, { trip });
      await page.setViewportSize({ width, height: 800 });
      await page.goto(Routes.page("home"));
      await note(page).fill("Pick up Mrs. Lee at 12 Oak St");
      await page.getByRole("button", { name: "Parse" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("respects the dark colour scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(Routes.page("home"));
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe("rgb(255, 255, 255)");
  });
});

test.describe("accessibility (axe in a real browser, including colour contrast)", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`idle, validation error and result pass in ${scheme} mode`, async ({ page }) => {
      await mockParseApi(page, {
        trip: { ...trip, dropoff_location: null, missing_fields: ["dropoff_location"] },
      });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(Routes.page("home"));
      const scan = () =>
        new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();

      expect((await scan()).violations).toEqual([]);

      await page.getByRole("button", { name: "Parse" }).click();
      await expect(page.getByText(MESSAGES.noteRequired)).toBeVisible();
      expect((await scan()).violations).toEqual([]);

      await note(page).fill("Pick up Mrs. Lee at 12 Oak St");
      await page.getByRole("button", { name: "Parse" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeVisible();
      expect((await scan()).violations).toEqual([]);
    });
  }
});
