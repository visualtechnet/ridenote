import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { Routes } from "../lib/routes";
import { emptyTrip, mockParseApi, tripWith } from "./fixtures";

// The result card is the screen people look at most, and its states carry the warnings (missing fields,
// "confirm mobility"). Contrast can only be measured in a real browser, in both themes.
const STATES = [
  ["a complete trip", tripWith()],
  ["no aid named (quiet confirm line)", tripWith({ mobility: [] })],
  ["several aids", tripWith({ mobility: ["wheelchair", "cane", "walker"] })],
  ["a missing time and no aid", tripWith({ pickup_time: null, mobility: [] })],
  ["everything missing", emptyTrip],
] as const;

for (const scheme of ["light", "dark"] as const) {
  for (const [name, state] of STATES) {
    test(`the result card has no accessibility violations: ${name}, ${scheme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await mockParseApi(page, { trip: state });
      await page.goto(Routes.page("home"));
      await page
        .getByRole("textbox", { name: "Dispatcher note" })
        .fill("Pick up Mrs. Lee at 12 Oak St at 9:30am, to County Hospital");
      await page.getByRole("button", { name: "Parse" }).click();
      await expect(page.getByRole("region", { name: "Parsed trip" })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
