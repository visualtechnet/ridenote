"use client";

import { useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/messages";
import type { Trip } from "@/lib/trip";
import { tripToText } from "@/lib/trip-text";

const STATUS_MS = 2500;

/**
 * Puts the card on the clipboard as plain text (lib/trip-text.ts), the dispatcher's path from the card
 * into a scheduling system. The outcome is written beside the button; the card sits inside the result's
 * polite live region, which announces it, so this adds no live region of its own (two would announce twice).
 */
export function CopyTripButton({ trip }: { trip: Trip }) {
  const [status, setStatus] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      // Throws where the clipboard is unavailable (an insecure page, a denied permission).
      await navigator.clipboard.writeText(tripToText(trip));
      setStatus(COPY.copied);
    } catch {
      setStatus(COPY.copyFailed);
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), STATUS_MS);
  };

  return (
    <span className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={copy}
        className="key focus-visible:outline-accent h-11 px-4 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {COPY.copyTrip}
      </button>
      {status && <span className="text-xs text-zinc-300">{status}</span>}
    </span>
  );
}
