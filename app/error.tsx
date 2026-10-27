"use client";

import { COPY, MESSAGES } from "@/lib/messages";

// Shown if something unexpected breaks while rendering. The error itself is never displayed:
// its text can contain internals that visitors shouldn't see.
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{COPY.errorTitle}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{MESSAGES.unexpected}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="bg-foreground text-background h-11 rounded-full px-6 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-50"
      >
        {COPY.tryAgain}
      </button>
    </main>
  );
}
