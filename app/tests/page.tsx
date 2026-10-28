import type { Metadata } from "next";
import { countTests, readTestCatalog } from "@/lib/test-catalog";

export const metadata: Metadata = {
  title: "Tests",
  description: "Every automated test, listed from the real test files.",
};

const KIND_HELP = {
  Unit: "Small pieces of logic in isolation: validation rules, the trip shape, rate limiting, routes and the API client.",
  Component:
    "Screens and widgets rendered in a simulated browser, including the API route with a stand-in AI.",
  Accessibility: "Automated accessibility checks (axe) on each screen state.",
  Config: "Settings such as security headers.",
  Eval: "The scoring code and case list behind the live accuracy eval (the eval itself calls the real AI and is run separately).",
} as const;

export default function TestsPage() {
  const files = readTestCatalog();
  // An empty list means the test files were not found. Fail the build rather than publish "0 tests".
  if (files.length === 0) throw new Error("No test files found for the Tests page.");
  const total = countTests(files);
  const kinds = (Object.keys(KIND_HELP) as (keyof typeof KIND_HELP)[]).filter((k) =>
    files.some((f) => f.kind === k),
  );

  return (
    <div className="flex flex-1 justify-center font-sans">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Tests</h1>
        <p className="mt-2 text-zinc-300">
          {total} automated tests across {files.length} files. This list is read from the real test
          files when the site is built, so it always matches what runs. Only test names are shown.
        </p>
        <p className="mt-2 text-zinc-300">
          Run them with{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-sm">npm test</code>.
          Browser tests in{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-sm">e2e/</code> run with{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-sm">
            npm run test:e2e
          </code>
          . The AI is always mocked, so tests are free and repeatable.
        </p>
        <dl className="mt-4 space-y-1 text-sm text-zinc-300">
          {kinds.map((k) => (
            <div key={k}>
              <dt className="inline font-medium text-zinc-50">{k}: </dt>
              <dd className="inline">{KIND_HELP[k]}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 space-y-3">
          {files.map((f) => (
            <details key={f.file} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <summary className="cursor-pointer font-mono text-sm break-words text-zinc-50">
                {f.file}{" "}
                <span className="font-sans text-zinc-400">
                  ({f.kind}, {f.groups.reduce((n, g) => n + g.tests.length, 0)} tests)
                </span>
              </summary>
              {f.groups.map((g) => (
                <section key={g.name} className="mt-3" aria-label={g.name}>
                  <h2 className="text-sm font-semibold text-zinc-50">{g.name}</h2>
                  <ul className="mt-1 list-disc space-y-1 pl-6 text-sm text-zinc-300">
                    {g.tests.map((t, i) => (
                      <li key={`${i}-${t}`}>{t}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </details>
          ))}
        </div>
      </main>
    </div>
  );
}
