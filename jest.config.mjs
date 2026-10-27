import nextJest from "next/jest.js";

// next/jest wires up the Next.js compiler, CSS/image stubs and .env loading for us.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/", "/.claude/", "/.agents/"],
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "lib/**/*.ts",
    "!**/*.test.*",
  ],
  coverageProvider: "v8",
  // A floor, not a goal: the build fails if coverage quietly erodes below this.
  coverageThreshold: { global: { statements: 98, branches: 95, functions: 98, lines: 98 } },
};

export default createJestConfig(config);
