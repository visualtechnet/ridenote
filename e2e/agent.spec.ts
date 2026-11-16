import { expect, test, type Page } from "@playwright/test";
import { productionServer } from "./fixtures";
import { Routes } from "../lib/routes";

/**
 * The agent runs against the stand-in model (E2E_STUB_PARSE): a note of the form `E2E:{trip}` gives
 * the trip, and the stand-in searches the rider file and proposes or asks. The real model is never
 * reached here, and these tests skip on a production build, which has no stand-in.
 */
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const e2eNote = (trip: Record<string, unknown>) => `E2E:${JSON.stringify(trip)}`;
const base = {
  pickup_location: "7 Harbor Rd",
  dropoff_location: "County Hospital",
  pickup_date: tomorrow,
  pickup_time: "09:00",
  mobility: [],
  missing_fields: [],
  notes: "",
};

const note = (page: Page) => page.getByRole("textbox", { name: "Dispatcher note" });
const planButton = (page: Page) => page.getByRole("button", { name: "Plan trip (agent)" });

test.describe("agent panel", () => {
  test.skip(productionServer, "the stand-in model is not in a production build");

  test.beforeEach(async ({ page }) => {
    // Each test is its own client, so the per-client agent limit (2 a minute in production) never
    // fails a test because another one ran first.
    const n = Math.floor(Math.random() * 250) + 1;
    await page.setExtraHTTPHeaders({ "x-real-ip": `10.7.0.${n}` });
  });

  test("plans one trip, shows the steps and saves it on Approve", async ({ page }) => {
    await page.goto(Routes.page("home"));
    await note(page).fill(e2eNote({ ...base, passenger_name: "James O'Neil" }));

    await planButton(page).click();
    await expect(page.getByText("Step 1: Looked up a rider")).toBeVisible();
    await expect(page.getByText("Step 2: Proposed a trip")).toBeVisible();
    await expect(page.getByText("James O'Neil, " + tomorrow)).toBeVisible();
    await expect(page.getByText("from note")).toBeVisible();

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved to History." })).toBeVisible();
    // The Approve button is gone once the trip is saved, so it cannot be pressed twice.
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  });

  test("asks which rider when two match, then resumes with the choice", async ({ page }) => {
    await page.goto(Routes.page("home"));
    await note(page).fill(e2eNote({ ...base, passenger_name: "Maria" }));

    await planButton(page).click();
    await expect(page.getByText("Which rider do you mean?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Maria Santos, 48 Birch Ave" })).toBeVisible();

    await page.getByRole("button", { name: "Maria Santos, 48 Birch Ave" }).click();
    // The resumed run has its own steps, so its proposal is its first step.
    await expect(page.getByText("Step 1: Proposed a trip")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
  });

  test("asks a question and proposes nothing when the note has no passenger", async ({ page }) => {
    await page.goto(Routes.page("home"));
    await note(page).fill(e2eNote({ ...base, passenger_name: null }));

    await planButton(page).click();
    await expect(page.getByText("Which passenger?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByText("Plan trip (agent)")).toBeVisible();
  });

  test("the panel refuses to plan without a valid note", async ({ page }) => {
    await page.goto(Routes.page("home"));
    await expect(planButton(page)).toBeDisabled();
  });
});
