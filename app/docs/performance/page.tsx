import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { readDoc } from "@/lib/docs-source";

export const metadata: Metadata = {
  title: "Performance, cost and abuse protection",
  description:
    "Why every parse costs money, what keeps the site fast and cheap, and how junk and abuse are stopped.",
};

export default function PerformancePage() {
  return (
    <div className="flex flex-1 justify-center font-sans">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Performance, cost and abuse protection
        </h1>
        <Markdown source={readDoc("PERFORMANCE")} />
      </main>
    </div>
  );
}
