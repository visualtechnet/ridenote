import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { LIMITS, RATE_LIMIT } from "../lib/config";
import { INVALID_EXAMPLES, VALID_EXAMPLES } from "../lib/docs-examples";
import { MESSAGES } from "../lib/messages";
import { Routes } from "../lib/routes";
import { emptyTrip, freshClient, mockParseApi, mockParseReplies, trip, tripWith } from "./fixtures";

const note = (page: Page) => page.getByRole("textbox", { name: "Dispatcher note" });
const parse = (page: Page) => page.getByRole("button", { name: "Parse" });
const card = (page: Page) => page.getByRole("region", { name: "Parsed trip" });
const alert = (page: Page) => page.locator("main").getByRole("alert");
const NOTE = "Pick up Mrs. Lee at 12 Oak St at 9:30am, to County Hospital, wheelchair";

/** Opens a page from the navigation: a sidebar on desktop, behind the Menu button on a phone. */
async function goTo(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: label }).click();
}

async function submit(page: Page, text: string) {
  await note(page).fill(text);
  await parse(page).click();
}

// ---------------------------------------------------------------------------------------------
test.describe("positive: what a successful parse looks like", () => {
  for (const [aids, shown] of [
    [["ambulatory"], ["Walks unaided"]],
    [["wheelchair"], ["Wheelchair"]],
    [["stretcher"], ["Stretcher"]],
    [
      ["wheelchair", "cane", "walker"],
      ["Wheelchair", "Cane", "Walker"],
    ],
    [
      ["crutches", "scooter", "other"],
      ["Crutches", "Scooter", "Other aid"],
    ],
  ] as const) {
    test(`shows ${aids.join(", ")} as ${shown.join(", ")} on the card`, async ({ page }) => {
      await mockParseApi(page, { trip: { ...trip, mobility: aids } });
      await page.goto(Routes.page("home"));
      await submit(page, NOTE);
      const list = card(page).getByRole("list", { name: "Mobility" });
      await expect(list.getByRole("listitem")).toHaveText([...shown]);
    });
  }

  test("an empty mobility list reads 'Not stated', with a quiet check line and no amber chip", async ({
    page,
  }) => {
    await mockParseApi(page, { trip: tripWith({ mobility: [] }) });
    await page.goto(Routes.page("home"));
    await submit(page, NOTE);
    await expect(card(page).getByRole("list", { name: "Mobility" })).toHaveCount(0);
    await expect(card(page).getByText("Not stated", { exact: true })).toHaveCount(1);
    await expect(
      card(page).getByText("Mobility not stated. Confirm before dispatching."),
    ).toBeVisible();
    await expect(card(page).getByRole("list", { name: "Missing fields" })).toHaveCount(0);
  });

  test("a named aid is not flagged as missing", async ({ page }) => {
    await mockParseApi(page, { trip: tripWith({ mobility: ["walker"] }) });
    await page.goto(Routes.page("home"));
    await submit(page, NOTE);
    await expect(card(page).getByRole("list", { name: "Missing fields" })).toHaveCount(0);
    await expect(card(page).getByText("Confirm before dispatching")).toHaveCount(0);
  });

  for (const [time, shown] of [
    ["09:30", "9:30 AM"],
    ["00:00", "12:00 AM"],
    ["12:00", "12:00 PM"],
    ["16:15", "4:15 PM"],
    ["23:59", "11:59 PM"],
  ] as const) {
    test(`shows pickup time ${time} as ${shown}`, async ({ page }) => {
      await mockParseApi(page, { trip: { ...trip, pickup_time: time } });
      await page.goto(Routes.page("home"));
      await submit(page, NOTE);
      const t = card(page).locator("time");
      await expect(t).toHaveText(shown);
      await expect(t).toHaveAttribute("datetime", time);
    });
  }

  test("lists missing fields and shows 'Not stated' for each empty value", async ({ page }) => {
    await mockParseApi(page, {
      trip: {
        ...trip,
        dropoff_location: null,
        pickup_time: null,
        missing_fields: ["dropoff_location", "pickup_time"],
      },
    });
    await page.goto(Routes.page("home"));
    await submit(page, "Pick up Mrs. Lee at 12 Oak St");
    await expect(card(page).getByText("Not stated", { exact: true })).toHaveCount(2);
    const missing = card(page).getByRole("list", { name: "Missing fields" });
    await expect(missing.getByRole("listitem")).toHaveText(["dropoff_location", "pickup_time"]);
  });

  test("shows the AI's note about an ambiguous request", async ({ page }) => {
    await mockParseApi(page, {
      trip: { ...trip, pickup_time: null, notes: "Time is vague (around lunch)." },
    });
    await page.goto(Routes.page("home"));
    await submit(page, "Take Ana to the clinic around lunch");
    await expect(card(page).getByText("Time is vague (around lunch).")).toBeVisible();
  });

  test("sends exactly what was typed (trimmed), including quotes, backslashes, accents, emoji and new lines", async ({
    page,
  }) => {
    const calls = await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));
    const tricky = 'Mrs. "Peg" O\'Brien at 5\\6 Elm St\nJosé Müller 🏥\tgate B';
    await submit(page, `   ${tricky}   `);
    await expect(card(page)).toBeVisible();
    expect(calls).toEqual([{ note: tricky }]);
  });

  test("every accepted example in the docs is sent to the API unchanged", async ({ page }) => {
    const calls = await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));
    for (const ex of VALID_EXAMPLES) {
      await submit(page, ex.note);
      await expect(card(page)).toBeVisible();
      await page.getByRole("button", { name: "Clear" }).click();
    }
    expect(calls).toHaveLength(VALID_EXAMPLES.length);
    // The page trims, so compare against the trimmed text.
    expect(calls).toEqual(VALID_EXAMPLES.map((e) => ({ note: e.note.trim() })));
  });

  test("a note of exactly the maximum length is accepted", async ({ page }) => {
    const calls = await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));
    await note(page).fill("a".repeat(LIMITS.noteMax));
    await expect(page.getByText(`${LIMITS.noteMax} / ${LIMITS.noteMax}`)).toBeVisible();
    await parse(page).click();
    await expect(card(page)).toBeVisible();
    expect(calls).toHaveLength(1);
  });

  test("padding with spaces does not count against the limit", async ({ page }) => {
    await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));
    await note(page).fill(`${"a".repeat(LIMITS.noteMax - 5)}${" ".repeat(50)}`);
    await expect(page.getByText(`${LIMITS.noteMax - 5} / ${LIMITS.noteMax}`)).toBeVisible();
    await expect(page.getByText(/please shorten/i)).toHaveCount(0);
  });

  test("a note is kept when moving to another page and back", async ({ page }) => {
    await page.goto(Routes.page("home"));
    await note(page).fill("Pick up Lee at 12 Oak St");
    await goTo(page, "Docs");
    await expect(page).toHaveURL(Routes.page("docs"));
    await goTo(page, "Parser");
    await expect(note(page)).toHaveValue("Pick up Lee at 12 Oak St");
  });
});

// ---------------------------------------------------------------------------------------------
test.describe("positive: avoiding unnecessary API calls", () => {
  test("parsing an unchanged note again does not call the API again", async ({ page }) => {
    const calls = await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));
    await submit(page, NOTE);
    await expect(card(page)).toBeVisible();
    await parse(page).click();
    await parse(page).click();
    await note(page).press("Control+Enter");
    expect(calls).toHaveLength(1);
  });

  test("editing the note flags the result as out of date, and re-parsing clears the flag", async ({
    page,
  }) => {
    const calls = await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));
    await submit(page, NOTE);
    await expect(card(page)).toBeVisible();
    await expect(page.getByText(/note has changed/i)).toHaveCount(0);

    await note(page).fill(`${NOTE} and bring the ramp`);
    await expect(page.getByText(/note has changed since this was parsed/i)).toBeVisible();

    await parse(page).click();
    await expect(page.getByText(/note has changed/i)).toHaveCount(0);
    expect(calls).toHaveLength(2);
  });

  test("a double click while waiting sends one request, and Parse and Clear are disabled meanwhile", async ({
    page,
  }) => {
    const calls = await mockParseReplies(page, [{ body: { trip }, delayMs: 500 }]);
    await page.goto(Routes.page("home"));
    await note(page).fill(NOTE);
    await parse(page).dblclick();
    await expect(page.getByRole("button", { name: "Parsing…" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Clear" })).toBeDisabled();
    await expect(card(page)).toBeVisible();
    expect(calls).toHaveLength(1);
  });

  test("a failed attempt can be retried and then succeeds", async ({ page }) => {
    const calls = await mockParseReplies(page, [
      { status: 502, body: { error: MESSAGES.parseFailed } },
      { body: { trip } },
    ]);
    await page.goto(Routes.page("home"));
    await submit(page, NOTE);
    await expect(alert(page)).toHaveText(MESSAGES.parseFailed);
    await parse(page).click();
    await expect(card(page)).toBeVisible();
    await expect(alert(page)).toHaveCount(0);
    expect(calls).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------------------------
test.describe("negative: the form refuses bad notes without calling the API", () => {
  const cases: [string, string, RegExp][] = [
    ["empty", "", /please enter a dispatcher note/i],
    ["only spaces", "      ", /please enter a dispatcher note/i],
    ["too short", "hi", /too short/i],
    ["a null byte", "Pick up Lee at 12 Oak St\u0000 at 9am", /hidden or unsupported/i],
    ["a zero-width space", "Pick up Lee at 12 Oak St​ at 9am", /hidden or unsupported/i],
    ["a right-to-left override", "Pick up Lee ‮ at 12 Oak St", /hidden or unsupported/i],
    ["a script tag", "Pick up <script>alert(1)</script> Lee", /can.t contain html/i],
    ["an HTML comment", "Pick up Lee <!-- x --> at 9am", /can.t contain html/i],
    ["a javascript: link", "Drop off at javascript:alert(1) Lee", /can.t contain html/i],
    ["a split javascript: link", "Drop off at java script:alert(1) Lee", /can.t contain html/i],
    ["too long", "a".repeat(LIMITS.noteMax + 1), /please shorten/i],
  ];
  for (const [name, text, message] of cases) {
    test(`rejects ${name}`, async ({ page }) => {
      const calls = await mockParseApi(page, { trip });
      await page.goto(Routes.page("home"));
      await note(page).fill(text);
      await parse(page).click();
      await expect(page.getByText(message)).toBeVisible();
      await expect(note(page)).toBeFocused();
      await expect(note(page)).toHaveAttribute("aria-invalid", "true");
      expect(calls).toHaveLength(0);
    });
  }

  test("every rejected example in the docs is refused by the real form", async ({ page }) => {
    const calls = await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));
    for (const ex of INVALID_EXAMPLES) {
      await note(page).fill(ex.note);
      await parse(page).click();
      await expect(page.locator("#note-error")).toBeVisible();
    }
    expect(calls).toHaveLength(0);
  });

  test("the over-limit counter turns on as soon as the limit is passed, before Parse is pressed", async ({
    page,
  }) => {
    await page.goto(Routes.page("home"));
    await note(page).fill("a".repeat(LIMITS.noteMax + 1));
    await expect(page.getByText(MESSAGES.noteTooLong(LIMITS.noteMax + 1))).toBeVisible();
  });

  test("the error goes away once the note is fixed", async ({ page }) => {
    const calls = await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));
    await submit(page, "<b>Lee</b>");
    await expect(page.locator("#note-error")).toBeVisible();
    await note(page).fill("Pick up Lee at 12 Oak St");
    await expect(page.locator("#note-error")).toHaveCount(0);
    await parse(page).click();
    await expect(card(page)).toBeVisible();
    expect(calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------
test.describe("negative: every server and network failure is shown kindly", () => {
  const failures: [
    string,
    number,
    Record<string, unknown>,
    Record<string, string> | undefined,
    RegExp,
  ][] = [
    [
      "400 bad request",
      400,
      { error: MESSAGES.noteMarkup, code: "markup" },
      undefined,
      /can.t contain html/i,
    ],
    ["413 too large", 413, { error: MESSAGES.bodyTooLarge }, undefined, /too large/i],
    ["415 wrong content type", 415, { error: MESSAGES.unsupportedMediaType }, undefined, /json/i],
    [
      "422 the assistant declined",
      422,
      { error: MESSAGES.modelDeclined },
      undefined,
      /couldn.t process/i,
    ],
    [
      "429 with Retry-After",
      429,
      { error: MESSAGES.tooManyRequests },
      { "Retry-After": "30" },
      /wait 30 seconds/i,
    ],
    [
      "429 without Retry-After",
      429,
      { error: MESSAGES.tooManyRequests },
      undefined,
      /going a bit fast/i,
    ],
    [
      "502 upstream failure",
      502,
      { error: MESSAGES.parseFailed },
      undefined,
      /couldn.t parse that note/i,
    ],
    ["503 busy", 503, { error: MESSAGES.busy }, { "Retry-After": "5" }, /lot of requests/i],
    ["500 with no JSON message", 500, {}, undefined, /couldn.t parse that note/i],
  ];
  for (const [name, status, body, headers, message] of failures) {
    test(`shows a friendly message for ${name}`, async ({ page }) => {
      await mockParseReplies(page, [{ status, body, headers }]);
      await page.goto(Routes.page("home"));
      await submit(page, NOTE);
      await expect(alert(page)).toContainText(message);
      await expect(alert(page)).not.toContainText(/stack|exception|undefined|\[object/i);
      await expect(note(page)).toHaveValue(NOTE); // never lose what the person typed
      await expect(parse(page)).toBeEnabled();
    });
  }

  test("shows a network message when the connection fails", async ({ page }) => {
    await page.route(`**${Routes.api("parse")}`, (route) => route.abort("connectionrefused"));
    await page.goto(Routes.page("home"));
    await submit(page, NOTE);
    await expect(alert(page)).toHaveText(MESSAGES.network);
    await expect(parse(page)).toBeEnabled();
  });

  test("shows a failure, not a broken card, when a success reply has the wrong shape", async ({
    page,
  }) => {
    await mockParseApi(page, { trip: { passenger_name: "X" } });
    await page.goto(Routes.page("home"));
    await submit(page, NOTE);
    await expect(alert(page)).toHaveText(MESSAGES.parseFailed);
    await expect(page.getByRole("region", { name: "Parsed trip" })).toHaveCount(0);
  });

  test("shows a failure when the reply is not JSON at all", async ({ page }) => {
    await page.route(`**${Routes.api("parse")}`, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Gateway</h1>" }),
    );
    await page.goto(Routes.page("home"));
    await submit(page, NOTE);
    await expect(alert(page)).toHaveText(MESSAGES.parseFailed);
    await expect(page.locator("main h1")).toHaveCount(1); // our own heading, not the reply's
  });

  test("an error clears when the next attempt works, and old results never linger beside new errors", async ({
    page,
  }) => {
    await mockParseReplies(page, [
      { body: { trip } },
      { status: 502, body: { error: MESSAGES.parseFailed } },
    ]);
    await page.goto(Routes.page("home"));
    await submit(page, NOTE);
    await expect(card(page)).toBeVisible();
    await submit(page, `${NOTE}, second stop`);
    await expect(alert(page)).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
test.describe("the real API: refuses bad requests before any paid call", () => {
  const url = Routes.api("parse");
  const json = { "content-type": "application/json" };

  test("400: not JSON, trailing comma, single quotes, empty body", async ({ request }) => {
    for (const data of ["Pick up Mrs. Lee", '{"note": "x",}', "{'note': 'hello there'}", ""]) {
      const res = await request.post(url, {
        data: Buffer.from(data),
        headers: { ...json, ...freshClient() },
      });
      expect(res.status(), data).toBe(400);
      expect((await res.json()).error).toBe(MESSAGES.invalidJson);
    }
  });

  test("400: a real line break inside the JSON string is invalid JSON", async ({ request }) => {
    const res = await request.post(url, {
      data: Buffer.from('{"note":"line one\nline two"}'),
      headers: { ...json, ...freshClient() },
    });
    expect(res.status()).toBe(400);
  });

  test("400 required: wrong field, wrong type, array, null, number, bare string", async ({
    request,
  }) => {
    for (const data of [
      '{"text":"Pick up Mrs. Lee"}',
      '{"note":12345}',
      '["Pick up Lee"]',
      "null",
      "42",
      '"Pick up Lee"',
      '{"note":null}',
      '{"note":{"a":1}}',
    ]) {
      const res = await request.post(url, {
        data: Buffer.from(data),
        headers: { ...json, ...freshClient() },
      });
      expect(res.status(), data).toBe(400);
      expect((await res.json()).code, data).toBe("required");
    }
  });

  test("400: each validation code is returned by the API", async ({ request }) => {
    const expected: Record<string, string> = {
      "": "required",
      hi: "too_short",
      [`${"a".repeat(LIMITS.noteMax + 1)}`]: "too_long",
      "Pick up Lee​ at 9am": "hidden_characters",
      "Pick up <b>Lee</b>": "markup",
    };
    for (const [text, code] of Object.entries(expected)) {
      const res = await request.post(url, { data: { note: text }, headers: freshClient() });
      expect(res.status()).toBe(400);
      expect((await res.json()).code).toBe(code);
    }
  });

  test("400 hidden_characters: valid JSON that decodes to a null byte is still refused", async ({
    request,
  }) => {
    const res = await request.post(url, {
      data: Buffer.from('{"note":"Pick up Lee\\u0000 at 12 Oak St"}'),
      headers: { ...json, ...freshClient() },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).code).toBe("hidden_characters");
  });

  test("413: a body over the size limit, even with an honest Content-Length", async ({
    request,
  }) => {
    const res = await request.post(url, {
      data: { note: "a".repeat(LIMITS.bodyMaxBytes + 1) },
      headers: freshClient(),
    });
    expect(res.status()).toBe(413);
    expect((await res.json()).error).toBe(MESSAGES.bodyTooLarge);
  });

  test("415: not declared as JSON", async ({ request }) => {
    const res = await request.post(url, {
      data: Buffer.from(JSON.stringify({ note: NOTE })),
      headers: { "content-type": "text/plain", ...freshClient() },
    });
    expect(res.status()).toBe(415);
    expect((await res.json()).error).toBe(MESSAGES.unsupportedMediaType);
  });

  test("405: only POST is allowed", async ({ request }) => {
    for (const method of ["get", "put", "delete", "patch"] as const) {
      const res = await request[method](url, { headers: freshClient() });
      expect(res.status(), method).toBe(405);
    }
  });

  test("429: one client is slowed down, another is not, and the reply says when to retry", async ({
    request,
  }) => {
    // The e2e server runs in production mode, so the strict per-client limit applies.
    const max = RATE_LIMIT.maxRequestsProduction;
    const greedy = freshClient();
    const statuses: number[] = [];
    let last = await request.post(url, { data: { note: "" }, headers: greedy });
    statuses.push(last.status());
    for (let i = 0; i < max + 1; i++) {
      last = await request.post(url, { data: { note: "" }, headers: greedy });
      statuses.push(last.status());
    }
    expect(statuses.slice(0, max).every((s) => s === 400)).toBe(true);
    expect(statuses.slice(max)).toEqual([429, 429]);
    expect(Number(last.headers()["retry-after"])).toBeGreaterThan(0);
    expect((await last.json()).error).toBe(MESSAGES.tooManyRequests);

    const other = await request.post(url, { data: { note: "" }, headers: freshClient() });
    expect(other.status()).toBe(400);
  });

  test("a spoofed leading x-forwarded-for entry does not escape the limit", async ({ request }) => {
    const real = freshClient()["x-forwarded-for"];
    let limited = 0;
    for (let i = 0; i < 12; i++) {
      const res = await request.post(url, {
        data: { note: "" },
        headers: { "x-forwarded-for": `1.2.3.${i}, ${real}` },
      });
      if (res.status() === 429) limited++;
    }
    expect(limited).toBeGreaterThan(0);
  });

  test("every reply is marked uncacheable", async ({ request }) => {
    const res = await request.post(url, { data: { note: "" }, headers: freshClient() });
    expect(res.headers()["cache-control"]).toBe("no-store");
  });
});

// ---------------------------------------------------------------------------------------------
test.describe("navigation, docs and the menu", () => {
  test("on a desktop the navigation is a vertical sidebar on the left, always visible", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(Routes.page("home"));
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
    await expect(nav.getByRole("link")).toHaveText([
      "Parser",
      "Requirements",
      "Docs",
      "Tests",
      "History",
      "Contact",
    ]);
    await expect(nav.getByRole("link", { name: "Parser" })).toHaveAttribute("aria-current", "page");

    const boxes = await nav.getByRole("link").evaluateAll((links) =>
      links.map((l) => {
        const r = l.getBoundingClientRect();
        return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right) };
      }),
    );
    const main = await page.locator("main").boundingBox();
    expect(new Set(boxes.map((b) => b.left)).size).toBe(1); // one column
    expect(boxes.map((b) => b.top)).toEqual([...boxes.map((b) => b.top)].sort((a, b) => a - b));
    expect(new Set(boxes.map((b) => b.top)).size).toBe(boxes.length); // stacked, not side by side
    expect(Math.max(...boxes.map((b) => b.right))).toBeLessThanOrEqual(main!.x); // left of the content
  });

  test("the sidebar stays in place while a long page scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(Routes.page("docs"));
    const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Docs" });
    const before = await link.boundingBox();
    await page.mouse.wheel(0, 3000);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    expect(await link.boundingBox()).toEqual(before);
  });

  test("on a desktop you can reach every page from the sidebar without a menu button", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(Routes.page("home"));
    for (const [label, route] of [
      ["Docs", Routes.page("docs")],
      ["Requirements", Routes.page("requirements")],
      ["Tests", Routes.page("tests")],
      ["History", Routes.page("history")],
      ["Contact", Routes.page("contact")],
      ["Parser", Routes.page("home")],
    ] as const) {
      await goTo(page, label);
      await expect(page).toHaveURL(route);
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    }
  });

  test("keyboard users can Tab through the sidebar links in order", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(Routes.page("home"));
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // brand
    for (const name of ["Parser", "Requirements", "Docs", "Tests", "History", "Contact"]) {
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }),
      ).toBeFocused();
    }
  });
});

test.describe("navigation on a phone", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("the links are hidden until the Menu button is pressed, and Escape closes them", async ({
    page,
  }) => {
    await page.goto(Routes.page("home"));
    const menu = page.getByRole("button", { name: "Menu" });
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(nav).toBeHidden();

    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("link")).toHaveText([
      "Parser",
      "Requirements",
      "Docs",
      "Tests",
      "History",
      "Contact",
    ]);
    await expect(nav.getByRole("link", { name: "Parser" })).toHaveAttribute("aria-current", "page");

    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
    await expect(menu).toBeFocused();
  });

  for (const [label, route, heading] of [
    ["Docs", Routes.page("docs"), "Documentation"],
    ["Requirements", Routes.page("requirements"), "Requirements"],
    ["Tests", Routes.page("tests"), "Tests"],
    ["History", Routes.page("history"), "History"],
    ["Contact", Routes.page("contact"), "Contact"],
  ] as const) {
    test(`the menu opens the ${label} page and closes itself`, async ({ page }) => {
      await page.goto(Routes.page("home"));
      await goTo(page, label);
      await expect(page).toHaveURL(route);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    });
  }

  test("the home page stays usable: parse works with the menu closed", async ({ page }) => {
    await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));
    await submit(page, NOTE);
    await expect(card(page)).toBeVisible();
  });
});

test.describe("docs pages", () => {
  test("the docs explain the status codes, the validation codes and the limits", async ({
    page,
  }) => {
    await page.goto(Routes.page("docs"));
    for (const status of ["400", "404", "413", "415", "422", "429", "502", "503"]) {
      await expect(
        page.getByRole("rowheader", { name: status, exact: true }).first(),
      ).toBeVisible();
    }
    for (const code of ["required", "too_short", "too_long", "hidden_characters", "markup"]) {
      await expect(page.getByRole("rowheader", { name: code, exact: true })).toBeVisible();
    }
    await expect(page.locator("main")).not.toContainText(/sk-ant|api[_-]?key\s*[:=]\s*\S{10,}/i);
  });

  test("a 'Try in the parser' button on the docs fills the parser, which then parses it", async ({
    page,
  }) => {
    const calls = await mockParseApi(page, { trip });
    await page.goto(Routes.page("docs"));
    await page.getByRole("button", { name: "Try in the parser" }).first().click();
    await expect(page).toHaveURL(Routes.page("home"));
    await expect(note(page)).toHaveValue(VALID_EXAMPLES[0].note);
    await parse(page).click();
    await expect(card(page)).toBeVisible();
    expect(calls).toEqual([{ note: VALID_EXAMPLES[0].note }]);
  });

  test("the docs' in-page links jump to their sections", async ({ page }) => {
    await page.goto(Routes.page("docs"));
    await page.getByRole("link", { name: "Breaking JSON" }).click();
    await expect(page).toHaveURL(/#json$/);
    await expect(page.getByRole("heading", { name: /ways to break the JSON/i })).toBeInViewport();
  });

  test("the requirements page shows the PRD, the input rules, the JSON output and the JSON rules", async ({
    page,
  }) => {
    await page.goto(Routes.page("requirements"));
    for (const name of [
      /product requirements/i,
      /required input/i,
      /expected output/i,
      /what is valid json/i,
      /what makes a parse succeed/i,
    ]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    for (const key of [
      "passenger_name",
      "pickup_location",
      "dropoff_location",
      "pickup_time",
      "mobility",
      "missing_fields",
      "notes",
    ]) {
      await expect(page.locator("pre", { hasText: `"${key}"` }).first()).toBeVisible();
    }
  });

  test("the tests page lists real tests and a non-zero count", async ({ page }) => {
    await page.goto(Routes.page("tests"));
    await expect(page.getByText(/\d+ automated tests across \d+ files/)).toBeVisible();
    await page.getByText("lib/validation.test.ts").click();
    await expect(page.getByText(/accepts exactly/i)).toBeVisible();
  });

  test("the skip link jumps past the header to the main content", async ({ page }) => {
    await page.goto(Routes.page("docs"));
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  for (const route of [
    Routes.page("docs"),
    Routes.page("requirements"),
    Routes.page("tests"),
    Routes.page("contact"),
  ]) {
    test(`${route} has no accessibility violations in light and dark mode`, async ({ page }) => {
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(route);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations, `${route} ${scheme}`).toEqual([]);
      }
    });

    test(`${route} does not scroll sideways on a phone`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

// ---------------------------------------------------------------------------------------------
test.describe("out of scope: things the app does not do, and how it behaves anyway", () => {
  test("an unknown page shows the 404 page, and so does an unknown page under /docs", async ({
    page,
  }) => {
    for (const path of ["/nope", "/docs/nope", "/requirements/x/y"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    }
  });

  test("an unknown API route is a 404, not a crash", async ({ request }) => {
    const res = await request.post("/api/does-not-exist", { data: {} });
    expect(res.status()).toBe(404);
  });

  test("a note with no trip information comes back as all-missing, not as an error", async ({
    page,
  }) => {
    await mockParseApi(page, { trip: emptyTrip });
    await page.goto(Routes.page("home"));
    await submit(page, "What is the weather like today? Also remember to buy milk.");
    await expect(page.getByRole("heading", { level: 2, name: "Unknown passenger" })).toBeVisible();
    await expect(card(page).getByText("Not stated", { exact: true })).toHaveCount(4);
    await expect(
      card(page).getByRole("list", { name: "Missing fields" }).getByRole("listitem"),
    ).toHaveCount(4); // the four required fields; mobility has its own quiet line
    await expect(
      card(page).getByText("Mobility not stated. Confirm before dispatching."),
    ).toBeVisible();
    await expect(alert(page)).toHaveCount(0);
  });

  test("a note describing two trips shows one card and the AI's caveat (several trips per note are not supported)", async ({
    page,
  }) => {
    await mockParseApi(page, {
      trip: { ...trip, notes: "The note describes two trips; only the first is captured." },
    });
    await page.goto(Routes.page("home"));
    await submit(
      page,
      "Pick up Lee at 9am from 1 Oak to the clinic, then pick up Kim at 2pm from 5 Elm to home",
    );
    await expect(page.getByRole("region", { name: "Parsed trip" })).toHaveCount(1);
    await expect(card(page).getByText(/two trips/i)).toBeVisible();
  });

  test("a note in another language is passed through untouched", async ({ page }) => {
    const calls = await mockParseApi(page, { trip });
    await page.goto(Routes.page("home"));
    const text =
      "Recoger a José Müller en Calle Ñandú 7 a las 6pm, silla de ruedas. 患者を午後3時に迎えに行く";
    await submit(page, text);
    await expect(card(page)).toBeVisible();
    expect(calls).toEqual([{ note: text }]);
  });

  test("very long unbroken text from the server stays inside the card on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await mockParseApi(page, {
      trip: {
        ...trip,
        passenger_name: "N".repeat(150),
        pickup_location: "A".repeat(250),
        notes: "x".repeat(250),
      },
    });
    await page.goto(Routes.page("home"));
    await submit(page, NOTE);
    await expect(card(page)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("a huge paste is refused politely and the page stays responsive", async ({ page }) => {
    await page.goto(Routes.page("home"));
    await note(page).fill("word ".repeat(40_000));
    await parse(page).click();
    await expect(page.getByText(/please shorten/i)).toBeVisible();
    await note(page).fill("Pick up Lee at 12 Oak St");
    await expect(page.getByText(/please shorten/i)).toHaveCount(0);
  });

  test("the browser back button returns from the docs to the parser", async ({ page }) => {
    await page.goto(Routes.page("home"));
    await goTo(page, "Docs");
    await expect(page).toHaveURL(Routes.page("docs"));
    await page.goBack();
    await expect(page).toHaveURL(Routes.page("home"));
    await expect(note(page)).toBeVisible();
  });

  test("a hostile message that echoes markup from the server is shown as text, never run", async ({
    page,
  }) => {
    await mockParseReplies(page, [
      { status: 400, body: { error: '<img src=x onerror="window.__xss=1">' } },
    ]);
    await page.goto(Routes.page("home"));
    await submit(page, NOTE);
    await expect(alert(page)).toContainText("<img");
    await expect(page.locator("main img")).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
    ).toBeUndefined();
  });
});

test.describe("the home page explains itself", () => {
  for (const [name, viewport] of [
    ["desktop", { width: 1280, height: 800 }],
    ["phone", { width: 360, height: 740 }],
  ] as const) {
    test(`shows the name, a short description and the three steps on a ${name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(Routes.page("home"));
      await expect(page).toHaveTitle(/RideNote/);
      await expect(page.getByRole("heading", { level: 1, name: "RideNote" })).toBeVisible();
      await expect(page.getByText(/turns a dispatcher.s free-text message/i)).toBeVisible();
      await expect(
        page.getByRole("list", { name: "How it works" }).getByRole("listitem"),
      ).toHaveCount(3);
      // The form is still on screen without scrolling far on a desktop.
      if (name === "desktop") await expect(note(page)).toBeInViewport();
    });
  }

  test("the old product name is gone from every page", async ({ page }) => {
    for (const route of [
      Routes.page("home"),
      Routes.page("docs"),
      Routes.page("requirements"),
      Routes.page("tests"),
      Routes.page("contact"),
    ]) {
      await page.goto(route);
      await expect(page.locator("body")).not.toContainText("Trip Parser");
    }
  });
});
