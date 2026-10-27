import { create } from "zustand";
import { COPY } from "./messages";

type ParserState = {
  /** What the person has typed. */
  note: string;
  /** True once validation messages should be visible (after blur or a submit attempt). */
  touched: boolean;
  setNote: (note: string) => void;
  touch: () => void;
  loadExample: () => void;
  reset: () => void;
};

/** Client-side UI state. Server state (the parse request and its result) lives in React Query. */
export const useParserStore = create<ParserState>()((set) => ({
  note: "",
  touched: false,
  setNote: (note) => set({ note }),
  touch: () => set({ touched: true }),
  loadExample: () => set({ note: COPY.exampleNote, touched: false }),
  reset: () => set({ note: "", touched: false }),
}));
