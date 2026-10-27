import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";
import { useParserStore } from "@/lib/store";

expect.extend(toHaveNoViolations);

// The store is a module-level singleton, so give every test a clean slate.
afterEach(() => useParserStore.setState(useParserStore.getInitialState(), true));
