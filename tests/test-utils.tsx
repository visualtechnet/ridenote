import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { missingFields, type Trip } from "@/lib/trip";

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

/**
 * A trip as the server would return it: missing_fields is computed from the data, so a test can never
 * show a state the server cannot produce (for example no aid named but mobility not flagged).
 */
export function makeTrip(overrides: Partial<Trip> = {}): Trip {
  const trip: Trip = {
    passenger_name: "Mrs. Lee",
    pickup_location: "12 Oak St",
    dropoff_location: "County Hospital",
    pickup_time: "09:30",
    mobility: ["wheelchair"],
    missing_fields: [],
    notes: "",
    ...overrides,
  };
  return { ...trip, missing_fields: missingFields(trip) };
}
