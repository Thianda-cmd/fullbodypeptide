"use client";

import { Fragment } from "react";
import { BY_SLUG, CATEGORY_COLOR, peptideHref } from "@/lib/catalog";
import { inAppClick } from "@/lib/measure";
import { useLibrary } from "@/components/shell/library-context";

type Node =
  | { t: "s"; v: string }
  | { t: "b"; c: Node[] }
  | { t: "a"; href: string; c: Node[] }
  | { t: "cite"; n: number };

export function parseRich(src: string): Node[] {
  const out: Node[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "s", v: buf });
    buf = "";
  };
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("**", i)) {
      const j = src.indexOf("**", i + 2);
      if (j > i + 2) {
        flush();
        out.push({ t: "b", c: parseRich(src.slice(i + 2, j)) });
        i = j + 2;
        continue;
      }
    }
    if (src[i] === "[") {
      const rest = src.slice(i);
      const cite = /^\[\^(\d+)\]/.exec(rest);
      if (cite) {
        flush();
        out.push({ t: "cite", n: Number(cite[1]) });
        i += cite[0].length;
        continue;
      }
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
      if (link) {
        flush();
        out.push({ t: "a", href: link[2], c: parseRich(link[1]) });
        i += link[0].length;
        continue;
      }
    }
    buf += src[i++];
  }
  flush();
  return out;
}

/** Plain text of a rich string (for meta tags and aria labels). */
export function plainText(src: string): string {
  const walk = (nodes: Node[]): string =>
    nodes.map((n) => (n.t === "s" ? n.v : n.t === "cite" ? "" : walk(n.c))).join("");
  return walk(parseRich(src));
}

function Nodes({ nodes, onCite }: { nodes: Node[]; onCite?: (n: number) => void }) {
  const lib = useLibrary();
  return (
    <>
      {nodes.map((n, i) => {
        if (n.t === "s") return <Fragment key={i}>{n.v}</Fragment>;
        if (n.t === "b")
          return (
            <strong key={i} className="font-medium text-ink">
              <Nodes nodes={n.c} onCite={onCite} />
            </strong>
          );
        if (n.t === "cite")
          return (
            <sup key={i} className="ml-[0.1em] text-[0.7em] leading-none">
              <a
                href={`#cite-${n.n}`}
                onClick={(e) => {
                  if (!onCite) return;
                  e.preventDefault();
                  onCite(n.n);
                }}
                aria-label={`Source ${n.n}`}
                className="rounded-[3px] px-[0.2em] text-ink/45 tabular-nums transition-colors duration-200 hover:bg-mist hover:text-ink"
              >
                {n.n}
              </a>
            </sup>
          );
        const internal = n.href.startsWith("/peptides/") ? BY_SLUG.get(n.href.slice("/peptides/".length)) : undefined;
        if (internal)
          return (
            <a
              key={i}
              href={peptideHref(internal.slug)}
              onClick={inAppClick(() => lib.openPeptide(internal))}
              className="text-ink underline decoration-[1.5px] underline-offset-[3px] transition-opacity duration-300 hover:opacity-70"
              style={{ textDecorationColor: CATEGORY_COLOR[internal.category].solid }}
            >
              <Nodes nodes={n.c} onCite={onCite} />
            </a>
          );
        return (
          <a
            key={i}
            href={n.href}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-ink/20 underline-offset-[3px] transition-[text-decoration-color] duration-300 hover:decoration-ink/70"
          >
            <Nodes nodes={n.c} onCite={onCite} />
          </a>
        );
      })}
    </>
  );
}

export function Rich({ text, onCite }: { text: string; onCite?: (n: number) => void }) {
  return <Nodes nodes={parseRich(text)} onCite={onCite} />;
}
