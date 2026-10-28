import AxeBuilder from "@axe-core/playwright";
import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { COPY } from "../lib/messages";
import { Routes } from "../lib/routes";
import type { Trip } from "../lib/trip";
import { emptyTrip, freshClient, tripWith } from "./fixtures";

// The e2e server runs like production with an in-memory store and a stubbed model: a note of the
// form E2E:{trip JSON} comes back as that trip, and everything after the model (validation,
// scrubbing, saving) is real. Saving happens after the response, so History is polled.

const unique = (label: string) => `${label} ${randomBytes(4).toString("hex")}`;

/** A browser tab with its own client address, so tests never share the 3-a-minute bucket. */
async function asNewClient(page: Page) {
  await page.setExtraHTTPHeaders(freshClient());
}

async function parseThroughUi(page: Page, trip: Trip) {
  await page.goto(Routes.page("home"));
  await page.getByRole("textbox", { name: "Dispatcher note" }).fill(`E2E:${JSON.stringify(trip)}`);
  await page.getByRole("button", { name: "Parse" }).click();
}

async function expectOnHistory(page: Page, text: string) {
  // The list streams in after the page loads, so each try waits briefly for the text to appear.
  await expect
    .poll(
      async () => {
        await page.goto(Routes.page("history"));
        return page
          .getByRole("main")
          .getByText(text, { exact: false })
          .first()
          .waitFor({ timeout: 3_000 })
          .then(
            () => true,
            () => false,
          );
      },
      { timeout: 20_000 },
    )
    .toBe(true);
}

const card = (page: Page, name: string) =>
  page.getByRole("article").filter({ has: page.getByRole("heading", { name }) });

test.describe("History", () => {
  test("a parsed note appears on /history with phone numbers and emails removed", async ({
    page,
  }) => {
    await asNewClient(page);
    const name = unique("Mrs. Saved");
    await parseThroughUi(
      page,
      tripWith({
        passenger_name: name,
        pickup_location: "12 Oak St, call 555-123-4567 or lee@example.com",
        dropoff_location: "County Hospital",
        pickup_time: "14:05",
        mobility: ["wheelchair"],
      }),
    );
    await expect(page.getByRole("region", { name: "Parsed trip" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Parsed trip" })).toContainText(
      /0 in · 0 out · \d+ ms/,
    );

    await expectOnHistory(page, name);
    const entry = card(page, name);
    await expect(entry).toContainText("12 Oak St");
    await expect(entry).toContainText("County Hospital");
    await expect(entry).toContainText("2:05 PM");
    await expect(entry).toContainText("Wheelchair");
    // The stubbed model reports 0 tokens; the latency is the real time the call took.
    await expect(entry).toContainText(/0 in · 0 out · \d+ ms/);
    const text = (await page.getByRole("main").textContent()) ?? "";
    expect(text).not.toContain("555-123-4567");
    expect(text).not.toContain("lee@example.com");
  });

  test("the fourth parse in a minute from one client is refused and only three are listed", async ({
    page,
  }) => {
    await asNewClient(page);
    const names = [1, 2, 3, 4].map((n) => unique(`Rapid ${n}`));
    for (const name of names.slice(0, 3)) {
      await parseThroughUi(page, tripWith({ passenger_name: name }));
      await expect(page.getByRole("region", { name: "Parsed trip" })).toContainText(name);
    }
    await parseThroughUi(page, tripWith({ passenger_name: names[3] }));
    await expect(page.locator("main").getByRole("alert")).toContainText(/going a bit fast/i);

    await expectOnHistory(page, names[2]);
    for (const name of names.slice(0, 3)) await expect(card(page, name)).toHaveCount(1);
    await expect(page.getByRole("main")).not.toContainText(names[3]);
  });

  test("a note that parses to nothing is not listed", async ({ page }) => {
    await asNewClient(page);
    const marker = unique("After empty");
    await parseThroughUi(page, emptyTrip);
    await expect(page.getByRole("region", { name: "Parsed trip" })).toBeVisible();
    await parseThroughUi(page, tripWith({ passenger_name: marker }));
    await expectOnHistory(page, marker);
    // Only these tests save entries, and none saves a trip with no name and no aids.
    await expect(page.getByRole("heading", { name: COPY.unknownPassenger })).toHaveCount(0);
  });

  test("/history asks search engines not to index it", async ({ page }) => {
    await page.goto(Routes.page("history"));
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the clean-up route refuses a caller without the secret and counts with it", async ({
    request,
  }) => {
    const without = await request.get(Routes.api("historyPurge"));
    expect(without.status()).toBe(401);
    const wrong = await request.get(Routes.api("historyPurge"), {
      headers: { authorization: "Bearer nope" },
    });
    expect(wrong.status()).toBe(401);
    const ok = await request.get(Routes.api("historyPurge"), {
      headers: { authorization: "Bearer e2e-secret" },
    });
    expect(ok.status()).toBe(200);
    expect(typeof (await ok.json()).deleted).toBe("number");
  });

  for (const [label, size] of [
    ["desktop", { width: 1280, height: 800 }],
    ["phone", { width: 390, height: 800 }],
  ] as const) {
    test(`the parser page shows the visitor notice on a ${label}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(Routes.page("home"));
      await expect(page.getByText(COPY.historyNotice)).toBeVisible();
    });
  }

  test("/history has no accessibility violations in light and dark mode, with entries listed", async ({
    page,
  }) => {
    await asNewClient(page);
    const name = unique("Mrs. Axe");
    await parseThroughUi(page, tripWith({ passenger_name: name }));
    await expectOnHistory(page, name);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(Routes.page("history"));
      await expect(card(page, name)).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, scheme).toEqual([]);
    }
  });

  test("/history does not scroll sideways at phone width with a very long name and address", async ({
    page,
  }) => {
    await asNewClient(page);
    const long = unique("W".repeat(150));
    await parseThroughUi(
      page,
      tripWith({
        passenger_name: long,
        pickup_location: "A".repeat(290),
        dropoff_location: "B".repeat(290),
      }),
    );
    await expectOnHistory(page, long.slice(0, 40));
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(Routes.page("history"));
    await expect(card(page, long)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
