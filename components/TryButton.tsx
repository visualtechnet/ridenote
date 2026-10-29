"use client";

import { useRouter } from "next/navigation";
import { COPY } from "@/lib/messages";
import { Routes } from "@/lib/routes";
import { useParserStore } from "@/lib/store";

/** Copies an example note into the parser's text box and opens the parser. */
export function TryButton({ note }: { note: string }) {
  const router = useRouter();
  const setNote = useParserStore((s) => s.setNote);
  return (
    <button
      type="button"
      onClick={() => {
        setNote(note);
        router.push(Routes.page("home"));
      }}
      className="key focus-visible:outline-accent min-h-11 px-4 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {COPY.tryInParser}
    </button>
  );
}
