/** @jest-environment node */
import { Routes } from "./routes";

describe("Routes", () => {
  it("returns the home page path", () => {
    expect(Routes.page("home")).toBe("/");
  });

  it("returns the parse API path", () => {
    expect(Routes.api("parse")).toBe("/api/parse");
  });

  it("lists every route exactly once", () => {
    const all = Routes.all();
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual(expect.arrayContaining([Routes.page("home"), Routes.api("parse")]));
  });

  it("gives the documentation sections their own pages under /docs", () => {
    expect(Routes.page("docsEval")).toBe("/docs/eval");
    expect(Routes.page("docsFaq")).toBe("/docs/faq");
    expect(Routes.all()).toEqual(expect.arrayContaining(["/docs/eval", "/docs/faq"]));
  });

  it("has a contact page", () => {
    expect(Routes.page("contact")).toBe("/contact");
  });

  it("only produces absolute paths", () => {
    for (const route of Routes.all()) expect(route.startsWith("/")).toBe(true);
  });

  it("keeps API routes under /api", () => {
    expect(Routes.api("parse").startsWith("/api/")).toBe(true);
  });
});
