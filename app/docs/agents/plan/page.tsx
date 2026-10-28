import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { readDoc } from "@/lib/docs-source";

export const metadata: Metadata = {
  title: "Implementation plan: History",
  description: "The task-by-task implementation plan for the History feature.",
};

export default function AgentsPlanPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Implementation plan: History
        </h1>
        <Markdown source={readDoc("superpowers/plans/2026-10-27-history")} />
      </main>
    </div>
  );
}
