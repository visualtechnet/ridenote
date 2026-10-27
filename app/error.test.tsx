import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorPage from "./error";
import { MESSAGES } from "@/lib/messages";

describe("error page", () => {
  it("shows a friendly message and never the underlying error text", () => {
    const error = new Error("ECONNREFUSED 10.0.0.5:5432 password=hunter2");
    render(<ErrorPage error={error} retry={jest.fn()} />);
    expect(screen.getByText(MESSAGES.unexpected)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("hunter2");
    expect(document.body).not.toHaveTextContent("ECONNREFUSED");
  });

  it("lets the user try again", async () => {
    const retry = jest.fn();
    render(<ErrorPage error={new Error("x")} retry={retry} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
