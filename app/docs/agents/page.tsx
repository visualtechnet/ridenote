import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { readDoc } from "@/lib/docs-source";

export const metadata: Metadata = {
  title: "Building with subagents",
  description:
    "A step-by-step guide to planning and building a feature with a team of AI subagents.",
};

export default function AgentsPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Building with subagents
        </h1>
        <Markdown source={readDoc("SUBAGENTS")} />
      </main>
    </div>
  );
}
