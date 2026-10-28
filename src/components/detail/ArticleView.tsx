"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { BY_SLUG, CATEGORY_LABEL, EVIDENCE_LABEL, ZONE_BY_ID, peptideHref, peptidesInZone, type Peptide } from "@/lib/catalog";
import { formatDate, type Article, type Block } from "@/lib/article";
import { inAppClick } from "@/lib/measure";
import { useLibrary } from "@/components/shell/library-context";
import { Shelf } from "@/components/shelf/Shelf";
import { Dot } from "@/components/ui/Dot";
import { ArrowUpRight } from "@/components/ui/Icons";
import { Rich } from "./RichText";
import { EvidenceMeter } from "./PeptideCard";

const EASE = [0.16, 1, 0.3, 1] as const;
const rule = "border-[rgb(9_9_11/0.08)]";
const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-32 flex-col gap-4">
      <h2 className="type-heading-xs font-normal text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Table({ rows, header, onCite, labelCol }: { rows: string[][]; header?: boolean; onCite: (n: number) => void; labelCol?: boolean }) {
  const [head, ...body] = header ? rows : [null, ...rows];
  return (
    <div className="overflow-x-auto rounded-[0.25rem] border border-[rgb(9_9_11/0.08)]">
      <table className="type-body-sm w-full border-collapse text-left">
        {head && (
          <thead className="bg-haze">
            <tr>
              {head.map((c, i) => (
                <th key={i} scope="col" className="px-5 py-3 align-top font-normal text-ink/55">
                  <Rich text={c} onCite={onCite} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {(body as string[][]).map((r, i) => (
            <tr key={i} className={`border-t ${rule} ${i === 0 && !head ? "border-t-0" : ""}`}>
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`px-5 py-3.5 align-top ${labelCol && j === 0 ? "w-[11rem] text-ink/55 max-sm:w-[8rem]" : "text-ink"}`}
                >
                  <Rich text={c} onCite={onCite} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Blocks({ blocks, onCite }: { blocks: Block[]; onCite: (n: number) => void }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "p":
            return (
              <p key={i} className="type-body-md text-ink/75">
                <Rich text={b.text} onCite={onCite} />
              </p>
            );
          case "h3":
            return (
              <h3 key={i} className="type-body-lg mt-2 text-ink">
                <Rich text={b.text} onCite={onCite} />
              </h3>
            );
          case "note":
            return (
              <p key={i} className="type-body-sm text-ink/50">
                <Rich text={b.text} onCite={onCite} />
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="flex flex-col gap-2">
                {b.items.map((it, j) => (
                  <li key={j} className="type-body-md relative pl-5 text-ink/75">
                    <span aria-hidden="true" className="absolute top-[0.8em] left-0 h-px w-2.5 bg-ink/40" />
                    <Rich text={it} onCite={onCite} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="flex flex-col gap-2">
                {b.items.map((it, j) => (
                  <li key={j} className="type-body-md relative pl-7 text-ink/75">
                    <span aria-hidden="true" className="absolute left-0 text-ink/40 tabular-nums">
                      {j + 1}.
                    </span>
                    <Rich text={it} onCite={onCite} />
                  </li>
                ))}
              </ol>
            );
          case "table":
            return <Table key={i} rows={b.rows} header={b.header} onCite={onCite} />;
        }
      })}
    </>
  );
}

function MoreShelf({ p }: { p: Peptide }) {
  const lib = useLibrary();
  const entries = useMemo(
    () =>
      peptidesInZone(p.zone)
        .filter((q) => q.slug !== p.slug)
        .slice(0, 6)
        .map((q) => ({ kind: "book" as const, p: q })),
    [p.zone, p.slug],
  );
  if (!entries.length) return null;
  return (
    <Section title={`More for ${lower(ZONE_BY_ID[p.zone].name)}`}>
      <Shelf entries={entries} fit onOpen={lib.openPeptide} label={`More for ${ZONE_BY_ID[p.zone].name}`} />
    </Section>
  );
}

function Related({ p }: { p: Peptide }) {
  const lib = useLibrary();
  const list = p.related.map((s) => BY_SLUG.get(s)).filter((x): x is Peptide => Boolean(x));
  if (!list.length) return null;
  return (
    <Section title="Also in the library">
      <ul className="flex flex-col">
        {list.map((q) => (
          <li key={q.slug} className={`border-t first:border-t-0 ${rule}`}>
            <a
              href={peptideHref(q.slug)}
              onClick={inAppClick(() => lib.openPeptide(q))}
              className="group flex items-center gap-3 py-3.5 transition-opacity duration-300 hover:opacity-70"
            >
              <Dot c={q.category} />
              <span className="type-body-md shrink-0 text-ink">{q.name}</span>
              <span className="type-body-sm truncate text-ink/45">{q.cls}</span>
              <ArrowUpRight className="ml-auto size-4 shrink-0 text-ink/40 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Guide({ p, article, onCite }: { p: Peptide; article: Article | null; onCite: (n: number) => void }) {
  if (!article) {
    return (
      <div className="flex flex-col gap-14 pb-24">
        <p className="type-body-lg max-w-[42rem] text-ink">{p.summary || `${p.name}: ${p.cls}.`}</p>
        <Section title="At a glance">
          <Table
            labelCol
            onCite={onCite}
            rows={[
              ["Status", p.status || CATEGORY_LABEL[p.category]],
              ["Class", p.cls || "—"],
              ["How it's taken", p.route || "—"],
              ["Evidence", EVIDENCE_LABEL[p.evidence]],
            ]}
          />
        </Section>
        {p.mechanism && (
          <Section title="How it works">
            <p className="type-body-md text-ink/75">{p.mechanism}.</p>
          </Section>
        )}
        <p className="type-body-sm text-ink/45">The full guide for this entry is being written.</p>
        <MoreShelf p={p} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-14 pb-24">
      <div className="flex flex-col gap-6">
        <p className="type-body-lg max-w-[42rem] text-ink">{article.summary}</p>
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <dt className="type-body-xs text-ink/45">Evidence</dt>
            <dd className="type-body-sm inline-flex items-center gap-2 text-ink/75">
              <EvidenceMeter level={p.evidence} /> {EVIDENCE_LABEL[p.evidence]}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="type-body-xs text-ink/45">Sources</dt>
            <dd className="type-body-sm text-ink/75">{article.citations.length} verified references</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="type-body-xs text-ink/45">Last updated</dt>
            <dd className="type-body-sm text-ink/75">{formatDate(article.updated)}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-3 rounded-[0.25rem] border border-[rgb(9_9_11/0.12)] p-6">
        <p className="type-body-sm text-ink/50">Key takeaway</p>
        <p className="type-body-md text-ink">
          <Rich text={article.takeaway} onCite={onCite} />
        </p>
      </div>

      <Section title="At a glance">
        <Table rows={article.glance} labelCol onCite={onCite} />
      </Section>

      {article.sections.map((s) => (
        <Section key={s.id} id={s.id} title={s.title}>
          <Blocks blocks={s.blocks} onCite={onCite} />
        </Section>
      ))}

      <aside className="flex flex-col gap-4 rounded-[0.25rem] bg-mist p-7">
        <p className="type-body-sm text-ink/50">Evidence strength</p>
        <p className="type-body-lg inline-flex items-center gap-3 text-ink">
          <EvidenceMeter level={p.evidence} />
          {article.evidence.label}
        </p>
        <p className="type-body-md text-ink/70">
          <Rich text={article.evidence.text} onCite={onCite} />
        </p>
      </aside>

      {article.faq.length > 0 && (
        <Section title="Frequently asked questions" id="faq">
          <dl className="flex flex-col">
            {article.faq.map((f) => (
              <div key={f.q} className={`flex flex-col gap-2 border-t py-5 first:border-t-0 first:pt-0 ${rule}`}>
                <dt className="type-body-lg text-ink">{f.q}</dt>
                <dd className="type-body-md text-ink/75">
                  <Rich text={f.a} onCite={onCite} />
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Related p={p} />
      <MoreShelf p={p} />

      <p className="type-body-xs max-w-[42rem] text-ink/45">
        This guide is educational and is not medical advice. Regulatory status reflects the United States as of{" "}
        {formatDate(article.updated)}. Talk to a licensed clinician before starting, stopping or changing any treatment.
      </p>
    </div>
  );
}

function Citations({ article, flash }: { article: Article | null; flash: number | null }) {
  const list = article?.citations ?? [];
  if (!list.length) return <p className="type-body-md pb-24 text-ink/55">No sources linked in this guide yet.</p>;
  return (
    <ol className="flex flex-col pb-24">
      {list.map((c) => (
        <li key={c.n} id={`cite-${c.n}`} className={`scroll-mt-40 border-t first:border-t-0 ${rule}`}>
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer"
            className={`group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-4 rounded-[0.25rem] py-4 transition-[opacity,background-color] duration-700 hover:opacity-70 ${
              flash === c.n ? "bg-accent-soft/50" : ""
            }`}
          >
            <span className="type-body-sm pl-2 text-ink/40 tabular-nums">{c.n}</span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="type-body-md text-ink">{c.title}</span>
              {c.note && <span className="type-body-sm text-ink/60 first-letter:uppercase">{c.note}</span>}
              <span className="type-body-sm truncate text-ink/45">
                {c.source}, {c.year}
                {c.doi ? ` · DOI ${c.doi}` : c.pmid ? ` · PMID ${c.pmid}` : ""}
              </span>
            </span>
            <ArrowUpRight className="mt-1 mr-2 size-4 text-ink/40 transition-[translate,color] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
          </a>
        </li>
      ))}
    </ol>
  );
}

export function ArticleView({ slug, article }: { slug: string; article: Article | null }) {
  const p = BY_SLUG.get(slug)!;
  const [tab, setTab] = useState<"guide" | "citations">("guide");
  const [flash, setFlash] = useState<number | null>(null);
  useEffect(() => {
    setTab("guide");
    setFlash(null);
  }, [slug]);

  const onCite = (n: number) => {
    setFlash(n);
    setTab("citations");
    setTimeout(() => document.getElementById(`cite-${n}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 380);
    setTimeout(() => setFlash(null), 2600);
  };

  const tabs = [
    { id: "guide" as const, label: "Guide" },
    { id: "citations" as const, label: article?.citations.length ? `Citations (${article.citations.length})` : "Citations" },
  ];

  return (
    <div>
      <div className="sticky top-16 z-10 mb-10 bg-paper/90 pt-6 backdrop-blur-xl">
        <div role="tablist" aria-label="Sections" className={`flex gap-7 border-b ${rule}`}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`type-body-md relative pb-3 transition-colors duration-300 ${tab === t.id ? "text-ink" : "text-ink/45 hover:text-ink/80"}`}
            >
              {t.label}
              {tab === t.id && (
                <motion.span layoutId="detail-tab" className="absolute inset-x-0 -bottom-px h-px bg-ink" transition={{ duration: 0.4, ease: EASE }} />
              )}
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          {tab === "guide" ? <Guide p={p} article={article} onCite={onCite} /> : <Citations article={article} flash={flash} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
