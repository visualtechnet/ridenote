import Link from "next/link";
import { COPY, MESSAGES } from "@/lib/messages";
import { Routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-zinc-50">{COPY.notFoundTitle}</h1>
      <p className="text-zinc-400">{MESSAGES.notFound}</p>
      <Link
        href={Routes.page("home")}
        className="font-medium text-zinc-50 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-50"
      >
        {COPY.backHome}
      </Link>
    </main>
  );
}
