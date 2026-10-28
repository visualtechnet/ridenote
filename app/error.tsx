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
      <h1 className="text-2xl font-semibold text-zinc-50">{COPY.errorTitle}</h1>
      <p className="text-zinc-400">{MESSAGES.unexpected}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="key run focus-visible:outline-accent h-11 px-6 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {COPY.tryAgain}
      </button>
    </main>
  );
}
