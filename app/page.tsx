"use client";

import { useEffect, useRef } from "react";
import { NoteForm } from "@/components/NoteForm";
import { ResultPanel } from "@/components/ResultPanel";
import { COPY } from "@/lib/messages";
import { useParserStore } from "@/lib/store";
import { useParseNote } from "@/lib/use-parse-note";
import { validateNote } from "@/lib/validation";

const JUMPS = [
  { id: "how-it-works", label: COPY.howItWorksLabel },
  { id: "note-section", label: COPY.noteLabel },
  { id: "result", label: COPY.resultLabel },
] as const;

export default function Home() {
  const parse = useParseNote();
  // A disabled button only takes effect after React re-renders, so a fast double click can slip
  // through. This ref flips synchronously and is the real lock.
  const inFlight = useRef(false);
  const note = useParserStore((s) => s.note);
  const current = validateNote(note);
  // A shown result belongs to the note that was parsed; flag it once the text has moved on.
  const stale = parse.variables !== undefined && !(current.ok && current.note === parse.variables);

  // Slide down to the card when an answer arrives (CSS decides whether that is smooth or instant).
  useEffect(() => {
    if (parse.data) document.getElementById("result")?.scrollIntoView?.({ block: "start" });
  }, [parse.data]);

  return (
    <div className="flex flex-1 justify-center font-sans">
      <main id="main" className="flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex flex-col gap-2">
          <h1 className="caps text-accent text-6xl leading-[0.9] font-extrabold tracking-[0.04em] sm:text-7xl">
            {COPY.appName}
          </h1>
          <p className="text-zinc-300">{COPY.intro}</p>
          <section aria-labelledby="how-it-works" className="mt-2">
            <h2 id="how-it-works" className="caps text-sm text-zinc-50">
              {COPY.howItWorksLabel}
            </h2>
            <ol
              aria-labelledby="how-it-works"
              className="mt-1 list-decimal space-y-1 pl-5 text-sm text-zinc-300"
            >
              {COPY.howItWorksSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </header>

        <nav aria-label={COPY.onThisPage} className="border-etch flex gap-6 border-y py-2">
          {JUMPS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="caps hover:text-accent focus-visible:outline-accent text-sm text-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {label}
            </a>
          ))}
        </nav>

        <div id="note-section">
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
        </div>
        <p className="text-sm text-zinc-300">{COPY.historyNotice}</p>
        <div id="result">
          <ResultPanel
            pending={parse.isPending}
            error={parse.error?.message ?? null}
            trip={parse.data?.trip}
            usage={parse.data?.usage}
            stale={stale}
          />
        </div>
      </main>
    </div>
  );
}
