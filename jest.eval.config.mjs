import nextJest from "next/jest.js";

// Live accuracy check against the real model. Separate from the unit tests because it costs money.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
export default createJestConfig({
  testEnvironment: "node",
  testMatch: ["<rootDir>/evals/**/*.eval.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
});
