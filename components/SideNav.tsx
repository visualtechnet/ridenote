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
  "caps block border-b border-transparent px-3 py-2.5 text-[15px] text-zinc-400 hover:text-accent aria-[current=page]:border-accent aria-[current=page]:text-accent md:flex md:min-h-11 md:items-center md:px-0 md:py-0";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

/**
 * Site navigation. A sticky top bar from the `md` breakpoint up; on a phone the links fold behind
 * a Menu button.
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
    <header className="border-etch-2 sticky top-0 z-20 border-b bg-zinc-950/95 backdrop-blur md:flex md:h-16 md:items-center md:gap-10 md:px-6">
      <div className="flex items-center justify-between px-4 py-3 md:p-0">
        <div className="flex items-baseline gap-4">
          <Link
            href={Routes.page("home")}
            className={`caps text-accent text-2xl leading-none font-extrabold tracking-[0.12em] ${FOCUS}`}
          >
            {COPY.appName}
          </Link>
          <p className="lab hidden xl:block">{COPY.tagline}</p>
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
          className={`caps border-etch-2 hover:text-accent min-h-11 border px-3 py-2 text-sm text-zinc-100 md:hidden ${FOCUS}`}
        >
          <span aria-hidden="true">{isOpen ? "✕ " : "☰ "}</span>
          {COPY.menu}
        </button>
      </div>
      <nav
        id="site-menu"
        aria-label={COPY.navLabel}
        className={`border-etch border-t md:ml-auto md:block md:border-t-0 ${isOpen ? "block" : "hidden"}`}
      >
        <ul className="flex flex-col gap-1 px-2 py-2 md:flex-row md:items-center md:gap-8 md:p-0">
          {LINKS.map(({ label, href }) => (
            <li key={href} className="md:flex md:items-center md:gap-4">
              <Link
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={`${LINK_CLASS} ${FOCUS}`}
              >
                {label}
              </Link>
              {href === Routes.page("docs") && inDocs && (
                <ul
                  aria-label={COPY.navDocsSections}
                  className="border-etch-2 mt-1 ml-4 flex flex-col gap-1 md:mt-0 md:ml-0 md:flex-row md:gap-4 md:border-l md:pl-4"
                >
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
