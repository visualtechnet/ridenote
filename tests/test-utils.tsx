import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

/** Renders with a fresh React Query client per test so results never leak between tests. */
export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// jsdom has no Response, so tests hand the page a minimal stand-in with the fields it reads.
export type FakeResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

export const reply = (body: unknown, status = 200): FakeResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
