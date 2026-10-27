"use client";

import { useRef } from "react";
import { NoteForm } from "@/components/NoteForm";
import { ResultPanel } from "@/components/ResultPanel";
import { COPY } from "@/lib/messages";
import { useParserStore } from "@/lib/store";
import { useParseNote } from "@/lib/use-parse-note";
import { validateNote } from "@/lib/validation";

export default function Home() {
  const parse = useParseNote();
  // A disabled button only takes effect after React re-renders, so a fast double click can slip
  // through. This ref flips synchronously and is the real lock.
  const inFlight = useRef(false);
  const note = useParserStore((s) => s.note);
  const current = validateNote(note);
  // A shown result belongs to the note that was parsed; flag it once the text has moved on.
  const stale = parse.variables !== undefined && !(current.ok && current.note === parse.variables);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      <main id="main" className="flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            {COPY.appName}
          </h1>
          <p className="text-zinc-700 dark:text-zinc-300">{COPY.intro}</p>
          <section aria-labelledby="how-it-works" className="mt-2">
            <h2 id="how-it-works" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {COPY.howItWorksLabel}
            </h2>
            <ol
              aria-labelledby="how-it-works"
              className="mt-1 list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300"
            >
              {COPY.howItWorksSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </header>

        <NoteForm
          pending={parse.isPending}
          onSubmit={(submitted) => {
            // The result on screen is already for exactly this note: don't pay for the same answer twice.
            if (parse.isSuccess && parse.variables === submitted) return;
            if (inFlight.current) return;
            inFlight.current = true;
            parse.mutate(submitted, { onSettled: () => (inFlight.current = false) });
          }}
          onClear={() => parse.reset()}
        />
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{COPY.historyNotice}</p>
        <ResultPanel
          pending={parse.isPending}
          error={parse.error?.message ?? null}
          trip={parse.data}
          stale={stale}
        />
      </main>
    </div>
  );
}
