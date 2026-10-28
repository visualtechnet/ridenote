"use client";

import { useRef, type FormEvent } from "react";
import { LIMITS } from "@/lib/config";
import { COPY } from "@/lib/messages";
import { useParserStore } from "@/lib/store";
import { trimOrdinary, validateNote } from "@/lib/validation";

type Props = {
  pending: boolean;
  onSubmit: (note: string) => void;
  onClear: () => void;
};

const BUTTON_FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-50";

export function NoteForm({ pending, onSubmit, onClear }: Props) {
  const { note, touched, setNote, touch, loadExample, reset } = useParserStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const validation = validateNote(note);
  // Count what the server counts: trimmed and normalised, not the raw characters typed.
  const length = trimOrdinary(note).normalize("NFC").length;
  const overLimit = length > LIMITS.noteMax;
  const error = !validation.ok && (touched || overLimit) ? validation.message : null;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (pending) return;
    touch();
    if (!validation.ok) {
      textareaRef.current?.focus();
      return;
    }
    onSubmit(validation.note);
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
      <label htmlFor="note" className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {COPY.noteLabel}
      </label>
      <textarea
        id="note"
        ref={textareaRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note.length > 0 && touch()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
        rows={6}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "note-help note-error" : "note-help"}
        placeholder={COPY.notePlaceholder}
        className={`w-full resize-y rounded-lg border bg-white p-3 text-base text-zinc-900 placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-900 dark:text-zinc-50 ${
          error
            ? "border-red-600 focus-visible:outline-red-600 dark:border-red-400"
            : "border-zinc-300 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:focus-visible:outline-zinc-50"
        }`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className={`bg-primary text-primary-ink hover:bg-primary-hover h-11 rounded-full px-6 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_FOCUS}`}
          >
            {pending ? COPY.parsing : COPY.parse}
          </button>
          <button
            type="button"
            onClick={loadExample}
            disabled={pending}
            className={`h-11 rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800 ${BUTTON_FOCUS}`}
          >
            {COPY.useExample}
          </button>
          {note.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                reset();
                onClear();
                textareaRef.current?.focus();
              }}
              className={`h-11 rounded-full px-4 text-sm font-medium text-zinc-700 underline-offset-4 hover:underline disabled:opacity-50 dark:text-zinc-300 ${BUTTON_FOCUS}`}
            >
              {COPY.clear}
            </button>
          )}
        </div>
        <p id="note-help" className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className={overLimit ? "font-medium text-red-700 dark:text-red-300" : undefined}>
            {`${length} / ${LIMITS.noteMax}`}
          </span>
          <span className="hidden sm:inline"> · {COPY.shortcutHint}</span>
        </p>
      </div>

      <div aria-live="polite">
        {error && (
          <p id="note-error" className="text-sm font-medium text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
