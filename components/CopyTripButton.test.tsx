import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyTripButton } from "./CopyTripButton";
import { COPY } from "@/lib/messages";
import { tripToText } from "@/lib/trip-text";
import { makeTrip } from "../tests/test-utils";

const trip = makeTrip({ passenger_name: "Mrs. Lee", pickup_date: "2026-11-06" });

describe("CopyTripButton", () => {
  it("puts the card on the clipboard as plain text and says so", async () => {
    const user = userEvent.setup();
    render(<CopyTripButton trip={trip} />);
    await user.click(screen.getByRole("button", { name: COPY.copyTrip }));
    expect(await screen.findByText(COPY.copied)).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(tripToText(trip));
    expect(await navigator.clipboard.readText()).toContain("Passenger: Mrs. Lee");
  });

  it("says when the clipboard refused, instead of failing silently", async () => {
    const user = userEvent.setup();
    jest.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));
    render(<CopyTripButton trip={trip} />);
    await user.click(screen.getByRole("button", { name: COPY.copyTrip }));
    expect(await screen.findByText(COPY.copyFailed)).toBeInTheDocument();
  });

  it("clears the message after a moment, so the next copy is announced again", async () => {
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<CopyTripButton trip={trip} />);
      await user.click(screen.getByRole("button", { name: COPY.copyTrip }));
      expect(await screen.findByText(COPY.copied)).toBeInTheDocument();
      act(() => jest.advanceTimersByTime(3000));
      expect(screen.queryByText(COPY.copied)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
