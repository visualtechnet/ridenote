import nextJest from "next/jest.js";

// next/jest wires up the Next.js compiler, CSS/image stubs and .env loading for us.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  // The skills folders hold copies of other tools' files, not this project's tests. They are anchored
  // to the project root (<rootDir>) so a git worktree, which lives under .claude/worktrees/, still runs.
  testPathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "/e2e/",
    "<rootDir>/.claude/",
    "<rootDir>/.agents/",
  ],
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
