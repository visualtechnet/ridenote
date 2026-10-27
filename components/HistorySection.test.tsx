import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { cacheLife } from "next/cache";
import { HISTORY } from "@/lib/config";
import type { HistoryRow } from "@/lib/history";
import { loadHistory } from "@/lib/history";
import { COPY } from "@/lib/messages";
import { HistorySection } from "./HistorySection";

jest.mock("next/cache", () => ({ cacheLife: jest.fn() }));
jest.mock("@/lib/history", () => ({ loadHistory: jest.fn() }));
jest.mock("next/server", () => ({ connection: jest.fn(async () => undefined) }));

const sample: HistoryRow = {
  id: 1,
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: null,
  pickup_time: "09:30",
  mobility: ["cane"],
  created_at: new Date("2026-10-27T14:05:00Z"),
};

const show = async () => render(await HistorySection());

describe("HistorySection", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    jest.mocked(loadHistory).mockReset();
    jest.mocked(cacheLife).mockClear();
  });

  it("says history is off when it is not enabled", async () => {
    jest.mocked(loadHistory).mockResolvedValue({ status: "disabled" });
    const { container } = await show();
    expect(screen.getByText(COPY.historyDisabled)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("says it could not load when the store fails", async () => {
    jest.mocked(loadHistory).mockResolvedValue({ status: "error" });
    const { container } = await show();
    expect(screen.getByRole("alert")).toHaveTextContent(COPY.historyError);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("says there are no entries yet", async () => {
    jest.mocked(loadHistory).mockResolvedValue({ status: "ok", rows: [] });
    const { container } = await show();
    expect(screen.getByText(COPY.historyEmpty)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("lists the entries", async () => {
    jest.mocked(loadHistory).mockResolvedValue({ status: "ok", rows: [sample] });
    const { container } = await show();
    expect(screen.getByRole("heading", { name: "Mrs. Lee" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("caches for the configured number of seconds in production", async () => {
    process.env = { ...env, VERCEL_ENV: "production", HISTORY_DATABASE_URL: "postgres://x" };
    delete process.env.HISTORY_STORE;
    jest.mocked(loadHistory).mockResolvedValue({ status: "ok", rows: [] });
    await show();
    expect(cacheLife).toHaveBeenCalledWith(
      expect.objectContaining({ revalidate: HISTORY.revalidateSec }),
    );
  });

  it("does not cache when the in-memory store is used, so a new entry shows at once", async () => {
    process.env = { ...env, HISTORY_STORE: "memory" };
    jest.mocked(loadHistory).mockResolvedValue({ status: "ok", rows: [] });
    await show();
    expect(cacheLife).not.toHaveBeenCalled();
  });
});
