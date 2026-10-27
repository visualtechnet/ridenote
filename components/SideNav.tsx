"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/messages";
import { Routes } from "@/lib/routes";

const LINKS = [
  { label: COPY.navParser, href: Routes.page("home") },
  { label: COPY.navRequirements, href: Routes.page("requirements") },
  { label: COPY.navDocs, href: Routes.page("docs") },
  { label: COPY.navTests, href: Routes.page("tests") },
  { label: COPY.navContact, href: Routes.page("contact") },
] as const;

/** Shown under "Docs" while any documentation page is open. */
const DOC_SECTIONS = [
  { label: COPY.navDocsSetup, href: Routes.page("docs") },
  { label: COPY.navDocsEval, href: Routes.page("docsEval") },
  { label: COPY.navDocsFaq, href: Routes.page("docsFaq") },
] as const;

const LINK_CLASS =
  "block rounded-md px-3 py-2.5 text-zinc-700 hover:bg-zinc-100 aria-[current=page]:bg-zinc-100 aria-[current=page]:font-semibold aria-[current=page]:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:aria-[current=page]:bg-zinc-900 dark:aria-[current=page]:text-zinc-50";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-50";

/**
 * Site navigation. A vertical sidebar on the left from the `md` breakpoint up; on a phone it
 * becomes a top bar with a Menu button that opens the same links.
 */
export function SideNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Following a link closes the menu: it is only "open" for the page it was opened on.
  const isOpen = open && openedAt === pathname;
  const inDocs = pathname === Routes.page("docs") || pathname.startsWith(`${Routes.page("docs")}/`);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <header className="border-b border-zinc-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between px-4 py-3 md:block md:px-5 md:py-6">
        <div>
          <Link
            href={Routes.page("home")}
            className={`text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 ${FOCUS}`}
          >
            {COPY.appName}
          </Link>
          <p className="mt-1 hidden text-sm text-zinc-600 md:block dark:text-zinc-400">
            {COPY.tagline}
          </p>
        </div>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={isOpen}
          aria-controls="site-menu"
          onClick={() => {
            setOpenedAt(pathname);
            setOpen(!isOpen);
          }}
          className={`rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 md:hidden dark:border-zinc-700 dark:text-zinc-50 ${FOCUS}`}
        >
          <span aria-hidden="true">{isOpen ? "✕ " : "☰ "}</span>
          {COPY.menu}
        </button>
      </div>
      <nav
        id="site-menu"
        aria-label={COPY.navLabel}
        className={`border-t border-zinc-200 md:block md:border-t-0 dark:border-zinc-800 ${isOpen ? "block" : "hidden"}`}
      >
        <ul className="flex flex-col gap-1 px-2 py-2 md:px-3">
          {LINKS.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={`${LINK_CLASS} ${FOCUS}`}
              >
                {label}
              </Link>
              {href === Routes.page("docs") && inDocs && (
                <ul aria-label={COPY.navDocsSections} className="mt-1 ml-4 flex flex-col gap-1">
                  {DOC_SECTIONS.map((section) => (
                    <li key={section.href}>
                      <Link
                        href={section.href}
                        aria-current={pathname === section.href ? "page" : undefined}
                        className={`${LINK_CLASS} py-2 text-sm ${FOCUS}`}
                      >
                        {section.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
