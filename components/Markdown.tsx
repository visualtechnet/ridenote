import type { ReactNode } from "react";
import { Routes } from "@/lib/routes";
import { parseMarkdown, type Block, type Inline } from "@/lib/markdown";

const HEADING_CLASS = {
  2: "mt-10 scroll-mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50",
  3: "mt-8 scroll-mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50",
  4: "mt-6 scroll-mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-50",
} as const;
/** Guides that link to each other by file name (so the links work on GitHub) get the site's route. */
const SITE_PAGE: Record<string, string> = {
  "FAQ.md": Routes.page("docsFaq"),
  "EVAL.md": Routes.page("docsEval"),
};

const BODY = "text-zinc-700 dark:text-zinc-300";
const CODE = "rounded bg-zinc-200 px-1 py-0.5 font-mono text-sm dark:bg-zinc-800";

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return node.text;
      case "code":
        return (
          <code key={i} className={CODE}>
            {node.text}
          </code>
        );
      case "strong":
        return <strong key={i}>{renderInline(node.children)}</strong>;
      case "em":
        return <em key={i}>{renderInline(node.children)}</em>;
      case "link": {
        const href = SITE_PAGE[node.href] ?? node.href;
        // Links to other files in the repository (README.md, SCALING.md) have no page here.
        if (!href.startsWith("#") && !href.startsWith("/") && !/^https?:/.test(href)) {
          return <span key={i}>{renderInline(node.children)}</span>;
        }
        const external = href.startsWith("http");
        return (
          <a
            key={i}
            href={href}
            className="underline underline-offset-4"
            {...(external ? { rel: "noopener noreferrer" } : {})}
          >
            {renderInline(node.children)}
          </a>
        );
      }
    }
  });
}

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as "h2" | "h3" | "h4" | "h5" | "h6";
      const cls = HEADING_CLASS[Math.min(block.level, 4) as 2 | 3 | 4];
      return (
        <Tag key={key} id={block.id} className={cls}>
          {renderInline(block.children)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className={`mt-3 ${BODY}`}>
          {renderInline(block.children)}
        </p>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      const marker = block.ordered ? "list-decimal" : "list-disc";
      return (
        <Tag key={key} className={`mt-3 ${marker} space-y-1 pl-6 ${BODY}`}>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </Tag>
      );
    }
    case "code":
      return (
        <pre
          key={key}
          className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 p-3 font-mono text-sm break-words whitespace-pre-wrap text-zinc-50"
        >
          {block.text}
        </pre>
      );
    case "rule":
      return <hr key={key} className="mt-10 border-zinc-300 dark:border-zinc-700" />;
  }
}

/** Renders a guide from docs/. See lib/markdown.ts for the (small) Markdown it understands. */
export function Markdown({ source, skipTitle = true }: { source: string; skipTitle?: boolean }) {
  return <>{parseMarkdown(source, { skipTitle }).map(renderBlock)}</>;
}
