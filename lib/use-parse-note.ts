import { useMutation } from "@tanstack/react-query";
import { parseNote, type ParseError } from "./api-client";
import type { Trip } from "./trip";

/** Wraps the parse request so components get pending / error / data state without wiring it by hand. */
export function useParseNote() {
  return useMutation<Trip, ParseError, string>({ mutationFn: parseNote });
}
