import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { readDoc } from "@/lib/docs-source";

export const metadata: Metadata = {
  title: "Design: History of parsed results",
  description: "The approved design for the History feature, as the subagent run produced it.",
};

export default function AgentsDesignPage() {
  return (
    <div className="flex flex-1 justify-center font-sans">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Design: History of parsed results
        </h1>
        <Markdown source={readDoc("superpowers/specs/2026-10-27-history-design")} />
      </main>
    </div>
  );
}
