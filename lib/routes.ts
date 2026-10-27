const PAGES = {
  home: "/",
  docs: "/docs",
  docsEval: "/docs/eval",
  docsFaq: "/docs/faq",
  requirements: "/requirements",
  tests: "/tests",
  contact: "/contact",
} as const;

const API = {
  parse: "/api/parse",
} as const;

/**
 * The single source of truth for every URL in the app. Components, tests and config ask this
 * class for a path instead of typing "/api/parse" themselves, so a route can be renamed in one place.
 */
export class Routes {
  static page(name: keyof typeof PAGES): string {
    return PAGES[name];
  }

  static api(name: keyof typeof API): string {
    return API[name];
  }

  /** Every route the app serves. */
  static all(): string[] {
    return [...Object.values(PAGES), ...Object.values(API)];
  }
}
