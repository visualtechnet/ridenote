import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { readDoc } from "@/lib/docs-source";

export const metadata: Metadata = {
  title: "FAQ and learnings",
  description:
    "Common questions, and the bugs and mistakes found while building, with their lessons.",
};

export default function FaqPage() {
  return (
    <div className="flex flex-1 justify-center font-sans">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          FAQ and key learnings
        </h1>
        <Markdown source={readDoc("FAQ")} />
      </main>
    </div>
  );
}
