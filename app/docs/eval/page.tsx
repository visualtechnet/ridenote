import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { CASES, PASS_RATE_FLOOR } from "@/evals/cases";
import { readDoc } from "@/lib/docs-source";

export const metadata: Metadata = {
  title: "Eval",
  description: "How the live accuracy eval works, and every case it checks.",
};

const th = "border-b px-3 py-2 text-left font-medium border-zinc-700";
const td = "border-b px-3 py-2 align-top border-zinc-800";

export default function EvalPage() {
  const critical = CASES.filter((c) => c.critical).length;
  return (
    <div className="flex flex-1 justify-center font-sans">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Eval</h1>
        <Markdown source={readDoc("EVAL")} />

        <h2 id="cases" className="mt-10 scroll-mt-4 text-xl font-semibold text-zinc-50">
          Every case
        </h2>
        <p className="mt-3 text-zinc-300">
          {CASES.length} notes, {critical} of them critical. A run needs every critical case and{" "}
          {Math.round(PASS_RATE_FLOOR * 100)}% of all cases to pass. This list is read from{" "}
          <code className="bg-zinc-800 px-1 py-0.5 font-mono text-sm">evals/cases.ts</code>, so it
          always matches what runs.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-200">
            <caption className="sr-only">Eval cases</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Case
                </th>
                <th scope="col" className={th}>
                  Kind
                </th>
                <th scope="col" className={th}>
                  Note sent to the AI
                </th>
              </tr>
            </thead>
            <tbody>
              {CASES.map((c) => (
                <tr key={c.name}>
                  <th scope="row" className={`${td} font-normal`}>
                    {c.name}
                  </th>
                  <td className={td}>{c.critical ? "Critical" : "Normal"}</td>
                  <td className={`${td} break-words whitespace-pre-wrap`}>{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
