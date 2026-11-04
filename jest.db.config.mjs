import nextJest from "next/jest.js";

// The store's real SQL against a real Postgres (DATABASE_URL, DB_APP_URL, DB_PURGE_URL). Separate from
// the unit tests because it needs a database server; CI starts one (see .github/workflows/ci.yml).
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
export default createJestConfig({
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/db/**/*.db.test.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
});
