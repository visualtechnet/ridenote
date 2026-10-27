import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TryButton } from "./TryButton";
import { Routes } from "@/lib/routes";
import { useParserStore } from "@/lib/store";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("TryButton", () => {
  it("puts the example in the parser's text box and opens the parser", async () => {
    render(<TryButton note="Pick up Lee at 12 Oak St" />);
    await userEvent.click(screen.getByRole("button", { name: /try in the parser/i }));
    expect(useParserStore.getState().note).toBe("Pick up Lee at 12 Oak St");
    expect(push).toHaveBeenCalledWith(Routes.page("home"));
  });
});
