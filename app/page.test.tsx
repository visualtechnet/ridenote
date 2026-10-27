import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "./page";
import { LIMITS } from "@/lib/config";
import { Routes } from "@/lib/routes";
import { COPY, MESSAGES } from "@/lib/messages";
import { renderWithProviders, reply, type FakeResponse } from "@/tests/test-utils";

const trip = {
  passenger_name: "Mrs. Lee",
  pickup_location: "12 Oak St",
  dropoff_location: null,
  pickup_time: "09:30",
  mobility: ["wheelchair"],
  missing_fields: ["dropoff_location"],
  notes: "",
};

const json = (body: unknown, status = 200) => Promise.resolve(reply(body, status));

const fetchMock = jest.fn();
const originalFetch = global.fetch;
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

const note = () => screen.getByRole("textbox", { name: /dispatcher note/i });
const parseBtn = () => screen.getByRole("button", { name: /parse/i });

describe("Home page", () => {
  it("has a labelled textarea and a Parse button that is always available when idle", () => {
    renderWithProviders(<Home />);
    expect(note()).toBeInTheDocument();
    expect(parseBtn()).toBeEnabled();
  });

  it("explains what to do, instead of failing silently, when Parse is clicked with nothing typed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.click(parseBtn());
    expect(await screen.findByText(MESSAGES.noteRequired)).toBeInTheDocument();
    expect(note()).toHaveAttribute("aria-invalid", "true");
    expect(note()).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats whitespace-only input as empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "   ");
    await user.click(parseBtn());
    expect(await screen.findByText(MESSAGES.noteRequired)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks a script injection attempt with a friendly message and never calls the server", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.click(note());
    await user.paste("<script>alert(document.cookie)</script>");
    await user.click(parseBtn());
    expect(await screen.findByText(MESSAGES.noteMarkup)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders hostile text from the server as plain text, never as HTML", async () => {
    const hostile = '<img src=x onerror="alert(1)">';
    fetchMock.mockReturnValue(json({ trip: { ...trip, passenger_name: hostile } }));
    const user = userEvent.setup();
    const { container } = renderWithProviders(<Home />);
    await user.type(note(), "Pick up Lee");
    await user.click(parseBtn());
    expect(await screen.findByRole("heading", { level: 2, name: hostile })).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("loads an example note and parses it", async () => {
    fetchMock.mockReturnValue(json({ trip }));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.click(screen.getByRole("button", { name: /use an example/i }));
    expect(note()).not.toHaveValue("");
    await user.click(parseBtn());
    expect(await screen.findByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeInTheDocument();
  });

  it("clears the note and the previous result, and returns focus to the textarea", async () => {
    fetchMock.mockReturnValue(json({ trip }));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Lee");
    await user.click(parseBtn());
    await screen.findByRole("heading", { level: 2, name: "Mrs. Lee" });

    await user.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(note()).toHaveValue("");
    expect(note()).toHaveFocus();
    expect(screen.queryByRole("region", { name: "Parsed trip" })).not.toBeInTheDocument();
  });

  it("shows a live character count", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "abc");
    expect(screen.getByText(`3 / ${LIMITS.noteMax}`)).toBeInTheDocument();
  });

  it("posts the trimmed note and shows a card, not raw JSON", async () => {
    fetchMock.mockReturnValue(json({ trip }));
    const user = userEvent.setup();
    const { container } = renderWithProviders(<Home />);

    await user.type(note(), "  Pick up Mrs. Lee  ");
    await user.click(parseBtn());

    expect(await screen.findByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeInTheDocument();
    expect(screen.getByText("12 Oak St")).toBeInTheDocument();
    expect(screen.getByText("Wheelchair")).toBeInTheDocument();
    expect(container.textContent).not.toContain('passenger_name"');
    expect(container.textContent).not.toContain("{");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(Routes.api("parse"));
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ note: "Pick up Mrs. Lee" });
  });

  it("submits with Ctrl+Enter from the textarea", async () => {
    fetchMock.mockReturnValue(json({ trip }));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Lee");
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(await screen.findByRole("heading", { level: 2, name: "Mrs. Lee" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("disables Parse and marks the result area busy while the request is in flight", async () => {
    let resolve!: (r: FakeResponse) => void;
    fetchMock.mockReturnValue(new Promise<FakeResponse>((r) => (resolve = r)));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Lee");
    await user.click(parseBtn());

    expect(screen.getByRole("button", { name: /parsing/i })).toBeDisabled();
    expect(screen.getByTestId("result-region")).toHaveAttribute("aria-busy", "true");

    resolve(reply({ trip }));
    await screen.findByRole("heading", { level: 2, name: "Mrs. Lee" });
    expect(screen.getByTestId("result-region")).toHaveAttribute("aria-busy", "false");
  });

  it("does not send a second request while one is in flight", async () => {
    fetchMock.mockReturnValue(new Promise<FakeResponse>(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Lee");
    await user.click(parseBtn());
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears the previous result when parsing an edited note", async () => {
    fetchMock.mockReturnValueOnce(json({ trip }));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Lee");
    await user.click(parseBtn());
    await screen.findByRole("heading", { level: 2, name: "Mrs. Lee" });

    fetchMock.mockReturnValueOnce(new Promise<FakeResponse>(() => {}));
    await user.type(note(), " at 9am"); // a changed note is a new request
    await user.click(parseBtn());
    expect(screen.queryByRole("heading", { level: 2, name: "Mrs. Lee" })).not.toBeInTheDocument();
  });

  it("shows the server's error message in an alert", async () => {
    fetchMock.mockReturnValue(json({ error: "Too many requests. Try again shortly." }, 429));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Lee");
    await user.click(parseBtn());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many requests. Try again shortly.",
    );
    expect(parseBtn()).toBeEnabled();
  });

  it("shows a generic alert when the response is not JSON", async () => {
    fetchMock.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Lee");
    await user.click(parseBtn());
    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent("Bad gateway");
    expect(alert).toHaveTextContent(/couldn.t parse|try again/i);
  });

  it("shows an alert when the network fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Lee");
    await user.click(parseBtn());
    expect(await screen.findByRole("alert")).toHaveTextContent(/network|try again/i);
  });

  it("rejects a malformed trip payload instead of crashing", async () => {
    fetchMock.mockReturnValue(json({ trip: { passenger_name: "X" } }));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Lee");
    await user.click(parseBtn());
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByRole("region", { name: "Parsed trip" })).not.toBeInTheDocument();
  });

  it("keeps the error alert outside the polite live region so it is not announced twice", async () => {
    fetchMock.mockReturnValue(json({ error: "Nope" }, 400));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Lee");
    await user.click(parseBtn());
    const alert = await screen.findByRole("alert");
    expect(screen.getByTestId("result-region")).not.toContainElement(alert);
  });

  it("tells the user how far over the limit they are, without truncating their text", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.click(note());
    const over = LIMITS.noteMax + 1;
    await user.paste("a".repeat(over));
    expect(screen.getByText(MESSAGES.noteTooLong(over))).toBeInTheDocument();
    expect(screen.getByText(`${over} / ${LIMITS.noteMax}`)).toBeInTheDocument();
  });

  it("flags a result as out of date once the note is edited, and clears the flag after re-parsing", async () => {
    fetchMock.mockReturnValue(json({ trip }));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Mrs. Lee at 12 Oak St");
    await user.click(parseBtn());
    await screen.findByRole("heading", { level: 2, name: "Mrs. Lee" });
    expect(screen.queryByText(/note has changed/i)).not.toBeInTheDocument();

    await user.type(note(), " going to the hospital");
    expect(screen.getByText(/note has changed since this was parsed/i)).toBeInTheDocument();

    await user.click(parseBtn());
    await waitFor(() => expect(screen.queryByText(/note has changed/i)).not.toBeInTheDocument());
  });

  it("does not call the API again for a note that is already parsed and unchanged", async () => {
    fetchMock.mockReturnValue(json({ trip }));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Mrs. Lee at 12 Oak St");
    await user.click(parseBtn());
    await screen.findByRole("heading", { level: 2, name: "Mrs. Lee" });
    await user.click(parseBtn());
    await user.click(parseBtn());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does call the API again after a failed attempt, so a retry is possible", async () => {
    fetchMock.mockReturnValueOnce(json({ error: "Nope" }, 502)).mockReturnValue(json({ trip }));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Mrs. Lee at 12 Oak St");
    await user.click(parseBtn());
    await screen.findByRole("alert");
    await user.click(parseBtn());
    await screen.findByRole("heading", { level: 2, name: "Mrs. Lee" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends one request for two clicks fired in the same instant (a disabled button is not a lock)", async () => {
    fetchMock.mockReturnValue(new Promise<FakeResponse>(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    await user.type(note(), "Pick up Mrs. Lee at 12 Oak St");
    fireEvent.click(parseBtn());
    fireEvent.click(parseBtn());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20)); // give a second request time to show up
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says what the app is, in a short description with three steps", () => {
    renderWithProviders(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: COPY.appName })).toBeInTheDocument();
    expect(screen.getByText(COPY.intro)).toBeInTheDocument();
    const steps = screen.getByRole("list", { name: COPY.howItWorksLabel });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(COPY.howItWorksSteps.length);
  });
});
