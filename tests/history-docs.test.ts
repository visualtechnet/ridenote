/** @jest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContactPage from "@/app/contact/page";
import DocsPage from "@/app/docs/page";
import RequirementsPage from "@/app/requirements/page";
import { RATE_LIMIT } from "@/lib/config";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const readme = read("README.md");
const schema = read("db/schema.sql");

describe("history documentation", () => {
  it("README states both per-client limits", () => {
    expect(readme).toContain(`${RATE_LIMIT.maxRequestsProduction} requests a minute`);
    expect(readme).toContain(`${RATE_LIMIT.maxRequests} requests a minute`);
  });

  it("README names the three new environment variables", () => {
    for (const name of ["HISTORY_DATABASE_URL", "HISTORY_PURGE_DATABASE_URL", "CRON_SECRET"]) {
      expect(readme).toContain(name);
    }
  });

  it.each([
    ["Requirements", RequirementsPage],
    ["Docs", DocsPage],
    ["Contact", ContactPage],
  ])("the %s page shows the production limit, not the development one", (_name, Page) => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain(`${RATE_LIMIT.maxRequestsProduction} `);
    expect(html).not.toMatch(new RegExp(`\\b${RATE_LIMIT.maxRequests} (parses|requests)`));
  });

  describe("example queries in the README", () => {
    const section = readme.slice(readme.search(/^#+ .*Query/im));
    const blocks = [...section.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1].trim());
    const columns = [...schema.matchAll(/^\s{2}([a-z_]+)\s+(?:bigint|timestamptz|text)/gm)].map(
      (m) => m[1],
    );
    const KNOWN = new Set([
      "select",
      "from",
      "where",
      "order",
      "by",
      "desc",
      "asc",
      "limit",
      "group",
      "count",
      "as",
      "and",
      "or",
      "history",
      "now",
      "interval",
      "any",
      "ilike",
      "like",
      "day",
      "days",
      "date",
      "between",
      "date_trunc",
      "unnest",
      "distinct",
      "having",
      "on",
      "is",
      "not",
      "null",
      ...columns,
    ]);

    it("has the five examples", () => {
      expect(columns).toEqual(
        expect.arrayContaining(["created_at", "pickup_location", "mobility"]),
      );
      expect(blocks.length).toBeGreaterThanOrEqual(5);
    });

    it("every example only reads, and uses only columns that exist", () => {
      for (const sql of blocks) {
        expect(sql).toMatch(/^select\b/i);
        const withoutStrings = sql.replace(/'[^']*'/g, "''").replace(/--.*$/gm, "");
        const words = withoutStrings.match(/[a-z_][a-z_0-9]*/gi) ?? [];
        const aliases = [...withoutStrings.matchAll(/\bas\s+([a-z_]\w*)/gi)].map((m) =>
          m[1].toLowerCase(),
        );
        const unknown = words.filter(
          (w) => !KNOWN.has(w.toLowerCase()) && !aliases.includes(w.toLowerCase()),
        );
        expect({ sql, unknown }).toEqual({ sql, unknown: [] });
      }
    });
  });
});
