import type { Metadata } from "next";
import { CONTACT, LIMITS, RATE_LIMIT } from "@/lib/config";
import { Routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the owner, and how to run RideNote with your own API key.",
};

const h2 = "mt-10 scroll-mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50";
const p = "mt-2 text-zinc-700 dark:text-zinc-300";
const link = "underline underline-offset-4";

export default function ContactPage() {
  const mailto = `mailto:${CONTACT.email}?subject=${encodeURIComponent(CONTACT.subject)}`;
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      <main id="main" className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Contact
        </h1>
        <p className={p}>
          Questions or feedback about RideNote? Write to{" "}
          <a href={mailto} className={link}>
            {CONTACT.email}
          </a>
          . API keys are not provided or shared, so please don&rsquo;t ask for one. See below for
          how to try it with your own.
        </p>

        <section aria-labelledby="demo">
          <h2 id="demo" className={h2}>
            The public demo
          </h2>
          <p className={p}>
            Anyone can use it as it is. It runs on a small, fixed budget of about $5 a month for
            everyone together, and that limit is not raised. When it is used up, the page says
            &ldquo;This demo has used up its AI budget&rdquo; and the demo stays unavailable until
            the monthly limit renews. Nothing is wrong with your note. Please keep to{" "}
            {RATE_LIMIT.maxRequests} parses a minute and notes under{" "}
            {LIMITS.noteMax.toLocaleString("en-US")} characters, and use made-up names, not real
            passengers.
          </p>
        </section>

        <section aria-labelledby="own-key">
          <h2 id="own-key" className={h2}>
            Run it yourself with your own key
          </h2>
          <p className={p}>
            To run RideNote on your own computer you need your own Anthropic API key. It takes about
            five minutes and you pay only for what you use, a fraction of a cent per parse.
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-zinc-700 dark:text-zinc-300">
            <li>Download the project from its repository and run npm install.</li>
            <li>Create an API key in your own Anthropic account.</li>
            <li>
              Copy <code className="font-mono text-sm">.env.example</code> to{" "}
              <code className="font-mono text-sm">.env.local</code> and paste your key after{" "}
              <code className="font-mono text-sm">ANTHROPIC_API_KEY=</code>.
            </li>
            <li>
              Run <code className="font-mono text-sm">npm run dev</code> and open{" "}
              <code className="font-mono text-sm">http://localhost:3000</code>.
            </li>
          </ol>
          <p className={p}>
            The full steps are in{" "}
            <a href={Routes.page("docs")} className={link}>
              the setup guide
            </a>
            . Keep your key private: never post it, share it, or commit it to a repository.
          </p>
        </section>
      </main>
    </div>
  );
}
