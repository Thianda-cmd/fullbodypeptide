"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CATEGORY_LABEL,
  ZONES,
  ZONE_BY_ID,
  ZONE_COUNT,
  peptideHref,
  topInZone,
  type Peptide,
  type ZoneId,
} from "@/lib/catalog";
import { inAppClick } from "@/lib/measure";
import { clearRecent, getRecent, popularHits, pushRecent, search, type Hit } from "@/lib/search";
import { Dot } from "@/components/ui/Dot";
import { Thumb } from "@/components/art/Thumb";
import { ArrowLeft, Close, SearchIcon } from "@/components/ui/Icons";

const EASE = [0.16, 1, 0.3, 1] as const;

function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.trim().toLowerCase());
  if (!q.trim() || i < 0) return <>{text}</>;
  const j = i + q.trim().length;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-ink">{text.slice(i, j)}</span>
      {text.slice(j)}
    </>
  );
}

const hitKey = (h: Hit) => (h.kind === "peptide" ? h.p.slug : `zone-${h.z.id}`);
const hitTitle = (h: Hit) => (h.kind === "peptide" ? h.p.name : h.z.name);
const hitMeta = (h: Hit) =>
  h.kind === "peptide" ? `${ZONE_BY_ID[h.p.zone].name} · ${CATEGORY_LABEL[h.p.category]}` : `Category · ${ZONE_COUNT[h.z.id]} peptides`;

interface Actions {
  onOpen: (p: Peptide) => void;
  onPickZone: (z: ZoneId) => void;
}

// ---------------------------------------------------------------- desktop combobox

export function SearchBox({ onOpen, onPickZone }: Actions) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const has = q.trim().length > 0;
  const hits = useMemo(() => (has ? search(q, 7) : popularHits(6)), [q, has]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea, [contenteditable]");
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        if (window.matchMedia("(max-width: 767px)").matches) return;
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (h?: Hit) => {
    if (!h) return;
    setQ("");
    input.current?.blur();
    if (h.kind === "peptide") {
      pushRecent(h.p);
      onOpen(h.p);
    } else onPickZone(h.z.id);
  };

  return (
    <div className="relative ml-auto h-10 w-[17rem] shrink-0 max-md:hidden lg:ml-0 xl:w-[18rem]" data-wheel-ignore>
      <label
        className={`absolute top-0 right-0 flex h-10 items-center gap-2.5 rounded-[0.5rem] border px-3.5 transition-[width,background-color,border-color] duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${
          focused ? "w-[21rem] border-[rgb(9_9_11/0.14)] bg-card" : "w-full border-transparent bg-mist"
        }`}
      >
        <SearchIcon className="size-4 shrink-0 text-ink/45" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(hits.length - 1, s + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(0, s - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(hits[sel]);
            } else if (e.key === "Escape") {
              setQ("");
              input.current?.blur();
            }
          }}
          placeholder="Search peptides"
          aria-label="Search peptides"
          role="combobox"
          aria-expanded={focused}
          aria-controls="search-list"
          aria-activedescendant={focused && hits[sel] ? `search-hit-${sel}` : undefined}
          autoComplete="off"
          spellCheck={false}
          className="type-body-sm min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink/40"
        />
        {!focused && (
          <kbd className="type-label hidden rounded-[4px] border border-line bg-card px-1.5 py-1 text-ink/40 lg:inline-block">/</kbd>
        )}
      </label>
      <AnimatePresence>
        {focused && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE } }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            className="absolute top-12 right-0 z-50 w-[21rem] overflow-hidden rounded-[0.5rem] border border-line bg-card shadow-[0_30px_60px_-20px_rgb(0_0_0/0.22),0_8px_20px_-12px_rgb(0_0_0/0.12)]"
          >
            {!has && <p className="type-body-xs px-4.5 pt-3.5 pb-1 text-ink/45">Popular searches</p>}
            {has && hits.length === 0 ? (
              <p className="type-body-sm px-4 py-4 text-ink/50">No peptide matches “{q.trim()}”.</p>
            ) : (
              <ul id="search-list" role="listbox" className="p-1.5">
                {hits.map((h, i) => {
                  const row = (
                    <span
                      className={`flex items-center gap-3 rounded-[0.25rem] px-3 py-2.5 transition-colors duration-150 ${
                        i === sel ? "bg-mist" : ""
                      }`}
                    >
                      {h.kind === "peptide" ? (
                        <Thumb p={h.p} className="size-8" />
                      ) : (
                        <span aria-hidden="true" className="size-8 shrink-0 rounded-[4px] border border-[rgb(9_9_11/0.12)]" />
                      )}
                      <span className="flex min-w-0 flex-col">
                        <span className="type-body-sm truncate text-ink/70">
                          <Highlight text={hitTitle(h)} q={q} />
                        </span>
                        <span className="type-body-xs truncate text-ink/45">{hitMeta(h)}</span>
                      </span>
                    </span>
                  );
                  return (
                    <li
                      key={hitKey(h)}
                      id={`search-hit-${i}`}
                      role="option"
                      aria-selected={i === sel}
                      onPointerEnter={() => setSel(i)}
                    >
                      {h.kind === "peptide" ? (
                        <a
                          href={peptideHref(h.p.slug)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={inAppClick(() => choose(h))}
                          className="block"
                        >
                          {row}
                        </a>
                      ) : (
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => choose(h)}
                          className="block w-full text-left"
                        >
                          {row}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {!has && (
              <div className="border-t border-[rgb(9_9_11/0.06)] px-4.5 pt-3 pb-4">
                <p className="type-body-xs pb-2.5 text-ink/45">Categories</p>
                <ul className="flex flex-wrap gap-1.5">
                  {ZONES.map((z) => (
                    <li key={z.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose({ kind: "zone", z, score: 0 })}
                        className="type-body-xs rounded-[0.5rem] bg-mist px-2.5 py-1.5 text-ink/70 transition-colors duration-200 hover:bg-[#e9e9eb] hover:text-ink"
                      >
                        {z.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- mobile overlay

const pill =
  "type-body-sm inline-flex h-9 items-center gap-2 rounded-full bg-mist px-3.5 text-ink active:bg-[#e9e9eb]";

export function MobileSearch({ onOpen, onPickZone, variant = "icon", className = "" }: Actions & { variant?: "icon" | "bar"; className?: string }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<Peptide[]>([]);
  const has = q.trim().length > 0;
  const hits = useMemo(() => (has ? search(q, 12) : []), [q, has]);

  const show = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (r) setFrom({ x: r.left, y: r.top, w: r.width, h: r.height });
    setRecent(getRecent());
    setQ("");
    setOpen(true);
  };
  const hide = () => {
    input.current?.blur();
    setOpen(false);
  };

  useLayoutEffect(() => {
    if (open) input.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (h: Hit) => {
    hide();
    if (h.kind === "peptide") {
      pushRecent(h.p);
      onOpen(h.p);
    } else onPickZone(h.z.id);
  };
  const openPeptide = (p: Peptide) => choose({ kind: "peptide", p, score: 0 });

  const vw = typeof window === "undefined" ? 1 : window.innerWidth;
  const vh = typeof window === "undefined" ? 1 : window.innerHeight;
  const collapsed = from
    ? {
        x: from.x,
        y: from.y,
        scaleX: from.w / vw,
        scaleY: from.h / vh,
        borderRadius: variant === "bar" ? `${(8 * vw) / from.w}px / ${(8 * vh) / from.h}px` : 999,
      }
    : { opacity: 0 };

  return (
    <>
      {variant === "bar" ? (
        <button
          ref={trigger}
          type="button"
          onClick={show}
          aria-label="Search peptides"
          className={`flex h-12 w-full items-center gap-1 rounded-[0.5rem] bg-mist pr-2 pl-1 text-left transition-opacity ${open ? "opacity-0" : ""} ${className}`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center text-ink/50">
            <SearchIcon className="size-5" />
          </span>
          <span className="text-base text-ink/40">Search peptides</span>
        </button>
      ) : (
        <button
          ref={trigger}
          type="button"
          onClick={show}
          aria-label="Search peptides"
          className={`-mr-2 ml-auto flex size-10 shrink-0 items-center justify-center rounded-full text-ink/70 active:bg-mist md:hidden ${className}`}
        >
          <SearchIcon className="size-5" />
        </button>
      )}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div role="dialog" aria-modal="true" aria-label="Search peptides" className="fixed inset-0 z-[60]">
                <motion.div
                  aria-hidden="true"
                  initial={collapsed}
                  animate={{ x: 0, y: 0, scaleX: 1, scaleY: 1, borderRadius: 0, opacity: 1, transition: { duration: 0.38, ease: [0.25, 1, 0.5, 1] } }}
                  exit={{ ...collapsed, transition: { duration: 0.3, ease: [0.25, 1, 0.5, 1] } }}
                  style={{ originX: 0, originY: 0 }}
                  className="absolute inset-0 bg-card"
                />
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.24, delay: 0.08, ease: [0.25, 1, 0.5, 1] } }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }}
                  className="relative flex h-full flex-col pt-[env(safe-area-inset-top)]"
                >
                  <form
                    role="search"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (hits[0]) choose(hits[0]);
                    }}
                    className="flex shrink-0 items-center px-4 pt-3 pb-2"
                  >
                    <label className="flex h-12 min-w-0 flex-1 items-center gap-1 rounded-[0.5rem] bg-mist pr-2 pl-1">
                      <button type="button" onClick={hide} aria-label="Close search" className="flex size-10 shrink-0 items-center justify-center text-ink/70">
                        <ArrowLeft className="size-5" />
                      </button>
                      <input
                        ref={input}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        type="search"
                        enterKeyHint="search"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="Search peptides"
                        aria-label="Search peptides"
                        className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink/40 [&::-webkit-search-cancel-button]:hidden"
                      />
                      {has && (
                        <button
                          type="button"
                          onClick={() => {
                            setQ("");
                            input.current?.focus();
                          }}
                          aria-label="Clear"
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink/50"
                        >
                          <Close className="size-4" />
                        </button>
                      )}
                    </label>
                  </form>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.26, delay: 0.14, ease: [0.25, 1, 0.5, 1] } }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
                  >
                    {has ? (
                      hits.length === 0 ? (
                        <p className="type-body-md pt-6 text-ink/50">No peptide matches “{q.trim()}”.</p>
                      ) : (
                        <ul role="listbox" className="flex flex-col pt-1">
                          {hits.map((h) => {
                            const row = (
                              <span className="flex items-center gap-3.5 py-3.5">
                                {h.kind === "peptide" ? (
                                  <Thumb p={h.p} className="size-10" />
                                ) : (
                                  <span aria-hidden="true" className="size-10 shrink-0 rounded-[4px] border border-[rgb(9_9_11/0.12)]" />
                                )}
                                <span className="flex min-w-0 flex-col">
                                  <span className="type-body-md truncate text-ink/60">
                                    <Highlight text={hitTitle(h)} q={q} />
                                  </span>
                                  <span className="type-body-sm truncate text-ink/45">{hitMeta(h)}</span>
                                </span>
                              </span>
                            );
                            return (
                              <li key={hitKey(h)} role="option" aria-selected={false} className="border-b border-[rgb(9_9_11/0.06)]">
                                {h.kind === "peptide" ? (
                                  <a href={peptideHref(h.p.slug)} onClick={inAppClick(() => choose(h))} className="block">
                                    {row}
                                  </a>
                                ) : (
                                  <button type="button" onClick={() => choose(h)} className="block w-full text-left">
                                    {row}
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )
                    ) : (
                      <div className="flex flex-col gap-7 pt-3">
                        {recent.length > 0 && (
                          <section className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <p className="type-body-sm text-ink">Recent</p>
                              <button
                                type="button"
                                onClick={() => {
                                  clearRecent();
                                  setRecent([]);
                                }}
                                className="type-body-sm text-ink/50 underline underline-offset-2"
                              >
                                Clear all
                              </button>
                            </div>
                            <ul className="flex flex-wrap gap-2">
                              {recent.map((p) => (
                                <li key={p.slug}>
                                  <a href={peptideHref(p.slug)} onClick={inAppClick(() => openPeptide(p))} className={pill}>
                                    <Dot c={p.category} />
                                    {p.name}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}
                        <section className="flex flex-col gap-3">
                          <p className="type-body-sm text-ink">Popular searches</p>
                          <ul className="flex flex-wrap gap-2">
                            {popularHits(8).map((h) =>
                              h.kind === "peptide" ? (
                                <li key={h.p.slug}>
                                  <a href={peptideHref(h.p.slug)} onClick={inAppClick(() => openPeptide(h.p))} className={pill}>
                                    <Dot c={h.p.category} />
                                    {h.p.name}
                                  </a>
                                </li>
                              ) : null,
                            )}
                          </ul>
                        </section>
                        <section className="flex flex-col gap-3">
                          <p className="type-body-sm text-ink">Browse by category</p>
                          <ul className="grid auto-rows-fr grid-cols-2 gap-2.5">
                            {ZONES.map((z) => (
                              <li key={z.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    hide();
                                    onPickZone(z.id);
                                  }}
                                  className="flex h-full w-full flex-col gap-1 rounded-[0.5rem] bg-haze p-3.5 text-left active:bg-mist"
                                >
                                  <span className="type-body-sm text-ink">
                                    {z.name}
                                    <span className="ml-[0.3em] text-ink/40">({ZONE_COUNT[z.id]})</span>
                                  </span>
                                  <span className="type-body-xs line-clamp-2 text-ink/50">
                                    {topInZone(z.id, 3)
                                      .map((p) => p.name)
                                      .join(", ")}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </section>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
