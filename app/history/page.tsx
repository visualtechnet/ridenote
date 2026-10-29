import type { Metadata } from "next";
import { Suspense } from "react";
import { HistorySection } from "@/components/HistorySection";
import { COPY } from "@/lib/messages";

export const metadata: Metadata = {
  title: COPY.historyTitle,
  description: COPY.historyDescription,
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return (
    <div className="flex flex-1 justify-center font-sans">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{COPY.historyTitle}</h1>
        <p className="mt-2 text-zinc-300">{COPY.historyPrivacy}</p>
        <Suspense fallback={<p className="mt-6 text-zinc-300">{COPY.historyLoading}</p>}>
          <HistorySection />
        </Suspense>
      </main>
    </div>
  );
}
