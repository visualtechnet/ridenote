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
  { label: COPY.navHistory, href: Routes.page("history") },
  { label: COPY.navContact, href: Routes.page("contact") },
] as const;

/** Shown under "Docs" while any documentation page is open. */
const DOC_SECTIONS = [
  { label: COPY.navDocsSetup, href: Routes.page("docs") },
  { label: COPY.navDocsEval, href: Routes.page("docsEval") },
  { label: COPY.navDocsFaq, href: Routes.page("docsFaq") },
  { label: COPY.navDocsAgents, href: Routes.page("docsAgents") },
] as const;

const LINK_CLASS =
  "block rounded-md px-3 py-2.5 text-rail-ink/90 hover:bg-white/10 aria-[current=page]:bg-white aria-[current=page]:font-semibold aria-[current=page]:text-[#0a4a94] dark:aria-[current=page]:text-[#071c38]";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

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

  // Setup is exactly /docs; every other section also owns the pages beneath it (/docs/agents/design).
  const isCurrentSection = (href: string) =>
    pathname === href || (href !== Routes.page("docs") && pathname.startsWith(`${href}/`));

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
    <header className="bg-rail text-rail-ink md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 md:block md:px-5 md:py-6">
        <div>
          <Link
            href={Routes.page("home")}
            className={`text-rail-ink text-xl font-bold tracking-tight ${FOCUS}`}
          >
            {COPY.appName}
          </Link>
          <p className="text-rail-ink/85 mt-1 hidden text-sm md:block">{COPY.tagline}</p>
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
          className={`text-rail-ink rounded-md border border-white/50 px-3 py-2 text-sm font-medium md:hidden ${FOCUS}`}
        >
          <span aria-hidden="true">{isOpen ? "✕ " : "☰ "}</span>
          {COPY.menu}
        </button>
      </div>
      <nav
        id="site-menu"
        aria-label={COPY.navLabel}
        className={`border-t border-white/20 md:block md:border-t-0 ${isOpen ? "block" : "hidden"}`}
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
                        aria-current={isCurrentSection(section.href) ? "page" : undefined}
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
