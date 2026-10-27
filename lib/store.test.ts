/** @jest-environment node */
import { COPY } from "./messages";
import { useParserStore } from "./store";

const state = () => useParserStore.getState();

describe("useParserStore", () => {
  it("starts empty and untouched", () => {
    expect(state().note).toBe("");
    expect(state().touched).toBe(false);
  });

  it("stores what is typed", () => {
    state().setNote("Pick up Lee");
    expect(state().note).toBe("Pick up Lee");
  });

  it("marks the form touched", () => {
    state().touch();
    expect(state().touched).toBe(true);
  });

  it("loads the example note and hides any validation message", () => {
    state().touch();
    state().loadExample();
    expect(state().note).toBe(COPY.exampleNote);
    expect(state().touched).toBe(false);
  });

  it("resets back to the starting state", () => {
    state().setNote("abc");
    state().touch();
    state().reset();
    expect(state().note).toBe("");
    expect(state().touched).toBe(false);
  });
});
