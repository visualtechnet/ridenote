import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { readDoc } from "@/lib/docs-source";

export const metadata: Metadata = {
  title: "RideNote for business users",
  description:
    "What RideNote does, what it will not do, and what to expect, in plain language for people who run or buy the service.",
};

export default function BusinessPage() {
  return (
    <div className="flex flex-1 justify-center font-sans">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          RideNote for business users
        </h1>
        <Markdown source={readDoc("BUSINESS")} />
      </main>
    </div>
  );
}
