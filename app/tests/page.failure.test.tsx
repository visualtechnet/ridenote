import TestsPage from "./page";

jest.mock("@/lib/test-catalog", () => ({
  readTestCatalog: () => [],
  countTests: () => 0,
}));

describe("Tests page when no test files are found", () => {
  it("fails loudly instead of publishing '0 tests'", () => {
    expect(() => TestsPage()).toThrow(/no test files found/i);
  });
});
