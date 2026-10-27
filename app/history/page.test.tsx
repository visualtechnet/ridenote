import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { COPY } from "@/lib/messages";
import HistoryPage, { metadata } from "./page";

jest.mock("@/components/HistorySection", () => ({
  HistorySection: () => <p>section</p>,
}));

describe("History page", () => {
  it("is not indexed by search engines", () => {
    expect(metadata.robots).toEqual(expect.objectContaining({ index: false }));
  });

  it("has one heading and the privacy line, and no accessibility violations", async () => {
    const { container } = render(<HistoryPage />);
    expect(screen.getByRole("heading", { level: 1, name: COPY.historyTitle })).toBeInTheDocument();
    expect(screen.getByText(COPY.historyPrivacy)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
