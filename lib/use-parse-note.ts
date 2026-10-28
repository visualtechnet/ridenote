import { useMutation } from "@tanstack/react-query";
import { parseNote, type ParseError } from "./api-client";
import type { Trip } from "./trip";
import type { Usage } from "./usage";

/** Wraps the parse request so components get pending / error / data state without wiring it by hand. */
export function useParseNote() {
  return useMutation<{ trip: Trip; usage?: Usage }, ParseError, string>({ mutationFn: parseNote });
}
