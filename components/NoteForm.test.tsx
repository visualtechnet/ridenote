import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoteForm } from "./NoteForm";
import { LIMITS } from "@/lib/config";
import { MESSAGES } from "@/lib/messages";

const setup = (props: Partial<React.ComponentProps<typeof NoteForm>> = {}) => {
  const onSubmit = jest.fn();
  const onClear = jest.fn();
  const user = userEvent.setup();
  render(<NoteForm pending={false} onSubmit={onSubmit} onClear={onClear} {...props} />);
  return { user, onSubmit, onClear };
};

const note = () => screen.getByRole("textbox", { name: /dispatcher note/i });

describe("NoteForm", () => {
  it("submits the trimmed, validated note", async () => {
    const { user, onSubmit } = setup();
    await user.type(note(), "  Pick up Mrs. Lee  ");
    await user.click(screen.getByRole("button", { name: "Parse" }));
    expect(onSubmit).toHaveBeenCalledWith("Pick up Mrs. Lee");
  });

  it("does not show an error while the user is still typing", async () => {
    const { user } = setup();
    await user.type(note(), "ab");
    expect(screen.queryByText(MESSAGES.noteTooShort)).not.toBeInTheDocument();
  });

  it("shows the error when the user leaves the field", async () => {
    const { user } = setup();
    await user.type(note(), "ab");
    await user.tab();
    expect(screen.getByText(MESSAGES.noteTooShort)).toBeInTheDocument();
  });

  it("links the error to the textarea for screen readers", async () => {
    const { user } = setup();
    await user.type(note(), "ab");
    await user.tab();
    expect(note()).toHaveAttribute("aria-invalid", "true");
    expect(note().getAttribute("aria-describedby")).toContain("note-error");
    expect(document.getElementById("note-error")).toHaveTextContent(MESSAGES.noteTooShort);
  });

  it("removes the error as soon as the note becomes valid", async () => {
    const { user } = setup();
    await user.type(note(), "ab");
    await user.tab();
    await user.type(note(), "cdefg");
    expect(screen.queryByText(MESSAGES.noteTooShort)).not.toBeInTheDocument();
    expect(note()).not.toHaveAttribute("aria-invalid");
  });

  it.each([
    ["a script tag", "<script>alert(1)</script>", MESSAGES.noteMarkup],
    ["an image onerror", "<img src=x onerror=alert(1)>", MESSAGES.noteMarkup],
    ["a javascript: link", "go to javascript:alert(1)", MESSAGES.noteMarkup],
  ])("blocks %s and does not submit", async (_name, text, message) => {
    const { user, onSubmit } = setup();
    await user.click(note());
    await user.paste(text);
    await user.click(screen.getByRole("button", { name: "Parse" }));
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with Ctrl+Enter and with Cmd+Enter", async () => {
    const { user, onSubmit } = setup();
    await user.type(note(), "Pick up Lee");
    await user.keyboard("{Control>}{Enter}{/Control}");
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("ignores submits while a request is pending", async () => {
    const { user, onSubmit } = setup({ pending: true });
    await user.type(note(), "Pick up Lee");
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(screen.getByRole("button", { name: "Parsing…" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("only offers Clear once there is text, and tells the parent when it is used", async () => {
    const { user, onClear } = setup();
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    await user.type(note(), "Pick up Lee");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(note()).toHaveValue("");
  });

  it("disables Clear while a request is pending", async () => {
    const { user } = setup({ pending: true });
    await user.type(note(), "Pick up Lee");
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("counts the trimmed note, as the server does, so padding never shows as over the limit", async () => {
    const { user } = setup();
    await user.click(note());
    const fits = LIMITS.noteMax - 10;
    await user.paste(`${"a".repeat(fits)}${" ".repeat(30)}`);
    expect(screen.getByText(`${fits} / ${LIMITS.noteMax}`)).toBeInTheDocument();
    expect(screen.queryByText(/please shorten/i)).not.toBeInTheDocument();
  });
});
