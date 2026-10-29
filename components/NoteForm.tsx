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
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
      <label htmlFor="note" className="lab">
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
        className={`bg-well w-full resize-y border p-3 font-mono text-[15px] text-zinc-50 transition-[border-color,box-shadow] duration-180 ease-(--ease) placeholder:text-zinc-500 focus-visible:shadow-(--shadow-focus) focus-visible:outline-none ${
          error
            ? "border-danger focus-visible:shadow-(--shadow-focus-danger)"
            : "border-edge focus-visible:border-accent"
        }`}
      />

      <div aria-hidden="true" className="bg-etch-2 h-0.5">
        <div
          className={`h-full ${overLimit ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${Math.min(100, (length / LIMITS.noteMax) * 100)}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className={`key run h-11 px-7 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_FOCUS}`}
          >
            {pending ? COPY.parsing : COPY.parse}
          </button>
          <button
            type="button"
            onClick={loadExample}
            disabled={pending}
            className={`key h-11 px-5 text-[15px] disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_FOCUS}`}
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
              className={`caps hover:text-accent h-11 px-4 text-[15px] text-zinc-300 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_FOCUS}`}
            >
              {COPY.clear}
            </button>
          )}
        </div>
        <p id="note-help" className="lab">
          <span className={overLimit ? "text-danger-ink font-medium" : undefined}>
            {`${length} / ${LIMITS.noteMax}`}
          </span>
          <span className="hidden sm:inline"> · {COPY.shortcutHint}</span>
        </p>
      </div>

      <div aria-live="polite">
        {error && (
          <p id="note-error" className="text-danger-ink text-sm font-medium">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
