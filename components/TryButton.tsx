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
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900 dark:focus-visible:outline-zinc-50"
    >
      {COPY.tryInParser}
    </button>
  );
}
