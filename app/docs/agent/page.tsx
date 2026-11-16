import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { readDoc } from "@/lib/docs-source";

export const metadata: Metadata = {
  title: "The agent, its loop and its evals",
  description:
    "A beginner's guide to the agent's four tools, its loop and its limits, and how it is tested.",
};

export default function AgentGuidePage() {
  return (
    <div className="flex flex-1 justify-center font-sans">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          The agent, its loop and its evals
        </h1>
        <Markdown source={readDoc("AGENT")} />
      </main>
    </div>
  );
}
