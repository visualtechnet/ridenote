import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { Routes } from "../lib/routes";

export const trip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: "County Hospital",
  pickup_time: "09:30",
  mobility: "wheelchair",
  missing_fields: [],
  notes: "Confirm ramp access.",
};

/** Replaces the real (paid) API with a canned response and records how many times it was called. */
export async function mockParseApi(page: Page, body: unknown, status = 200) {
  const calls: unknown[] = [];
  await page.route(`**${Routes.api("parse")}`, async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  return calls;
}

type Reply = {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  delayMs?: number;
};

/**
 * Replaces the API with replies chosen per call: the nth call gets the nth reply, and the last
 * reply repeats. Records every request body so tests can check exactly what was sent.
 */
export async function mockParseReplies(page: Page, replies: Reply[]) {
  const calls: unknown[] = [];
  await page.route(`**${Routes.api("parse")}`, async (route) => {
    const reply = replies[Math.min(calls.length, replies.length - 1)];
    calls.push(route.request().postDataJSON());
    if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
    await route.fulfill({
      status: reply.status ?? 200,
      contentType: "application/json",
      headers: reply.headers,
      body: JSON.stringify(reply.body),
    });
  });
  return calls;
}

/** A unique client address per call, so tests of the real API never share a rate-limit bucket. */
export const freshClient = () => {
  const [a, b] = randomBytes(2);
  return { "x-forwarded-for": `198.18.${a}.${b}` };
};

export const emptyTrip = {
  passenger_name: null,
  pickup_location: null,
  dropoff_location: null,
  pickup_time: null,
  mobility: "unknown",
  missing_fields: ["passenger_name", "pickup_location", "dropoff_location", "pickup_time"],
  notes: "",
};
