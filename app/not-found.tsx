import Link from "next/link";
import { COPY, MESSAGES } from "@/lib/messages";
import { Routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="caps text-3xl text-zinc-50">{COPY.notFoundTitle}</h1>
      <p className="text-zinc-400">{MESSAGES.notFound}</p>
      <Link
        href={Routes.page("home")}
        className="caps hover:text-accent focus-visible:outline-accent inline-flex min-h-11 items-center text-[15px] text-zinc-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {COPY.backHome}
      </Link>
    </main>
  );
}
