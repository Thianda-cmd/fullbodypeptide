"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ZONE_BY_ID, peptideHref, peptidesInZone, splitName, zoneHref, type Peptide } from "@/lib/catalog";
import { inAppClick } from "@/lib/measure";
import { setProgress } from "@/lib/progress";
import { useLibrary } from "@/components/shell/library-context";
import { Spinner } from "@/components/ui/Spinner";
import { PeptideCard, type CardFlight } from "./PeptideCard";

const EASE = [0.16, 1, 0.3, 1] as const;
const slide = {
  initial: { opacity: 0, x: -36 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } },
  exit: { opacity: 0, x: 36, transition: { duration: 0.2, ease: "easeIn" as const } },
};

function ShelfTicks({ p }: { p: Peptide }) {
  const lib = useLibrary();
  const list = peptidesInZone(p.zone);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <nav
      aria-label={`More in ${ZONE_BY_ID[p.zone].name}`}
      className="fixed top-1/2 left-4 z-20 flex -translate-y-1/2 flex-col max-lg:hidden"
      onPointerLeave={() => setHover(null)}
    >
      {list.map((q) => {
        const current = q.slug === p.slug;
        const on = hover === q.slug;
        return (
          <a
            key={q.slug}
            href={peptideHref(q.slug)}
            aria-current={current ? "page" : undefined}
            aria-label={q.name}
            onPointerEnter={() => setHover(q.slug)}
            onFocus={() => setHover(q.slug)}
            onClick={inAppClick(() => !current && lib.openPeptide(q))}
            className="relative flex h-[11px] items-center"
          >
            <span
              aria-hidden="true"
              className={`h-px bg-ink transition-[width,opacity] duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${
                current ? "w-5 opacity-100" : on ? "w-4 opacity-70" : "w-2.5 opacity-25"
              }`}
            />
            <span
              className={`type-body-xs pointer-events-none absolute left-7 rounded-full bg-white/90 px-2 py-0.5 whitespace-nowrap text-ink shadow-[0_2px_10px_rgb(0_0_0/0.06)] backdrop-blur-md transition-[opacity,translate] duration-300 ${
                on ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"
              }`}
            >
              {splitName(q.name).base}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

const FADE_STOPS = [0, 0.04, 0.11, 0.2, 0.31, 0.43, 0.56, 0.68, 0.79, 0.88, 0.95, 1]
  .map((a, i, arr) => `rgb(255 255 255 / ${a}) ${Math.round((i / (arr.length - 1)) * 100)}%`)
  .join(", ");

/** Soft white fade along the bottom of the reading column; disappears near the page end. */
function BottomFade({ hidden, column }: { hidden: boolean; column: React.RefObject<HTMLElement | null> }) {
  const el = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const update = useCallback(() => {
    const f = el.current;
    const c = column.current?.getBoundingClientRect();
    if (!f) return;
    if (c) {
      f.style.left = `${c.left - 24}px`;
      f.style.width = `${c.width + 48}px`;
    }
    const left = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    const t = Math.max(0, Math.min(1, left / 320));
    f.style.opacity = hiddenRef.current ? "0" : String(t * t * (3 - 2 * t));
  }, [column]);
  useEffect(() => {
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, [update]);
  useEffect(update, [hidden, update]);
  return (
    <div
      ref={el}
      aria-hidden="true"
      className="pointer-events-none fixed bottom-0 left-0 z-[15] h-40 w-0 opacity-0 transition-opacity duration-500 ease-out"
      style={{ background: `linear-gradient(to bottom, ${FADE_STOPS})` }}
    />
  );
}

interface Props {
  p: Peptide;
  ready: boolean;
  closing: boolean;
  flight: CardFlight | null;
  children: React.ReactNode;
}

export function DetailFrame({ p, ready, closing, flight, children }: Props) {
  const lib = useLibrary();
  const column = useRef<HTMLDivElement>(null);
  const zone = ZONE_BY_ID[p.zone];

  // page scroll drives the progress line while reading
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? window.scrollY / max : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [p.slug]);

  return (
    <div className="relative z-10 min-h-svh">
      <ShelfTicks p={p} />
      <BottomFade hidden={closing || flight !== null} column={column} />
      <div className="mx-auto grid w-full max-w-[84rem] grid-cols-1 gap-10 px-6 pt-24 md:px-10 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:gap-20 lg:pt-28">
        <div className="h-[30rem] sm:h-[34rem] lg:sticky lg:top-28 lg:h-[calc(100svh-9rem)] lg:max-h-[46rem]">
          <PeptideCard p={p} flight={flight} closing={closing} />
        </div>
        <motion.div
          ref={column}
          initial={{ opacity: 0, y: 24 }}
          animate={closing ? { opacity: 0, y: 0, transition: { duration: 0.16 } } : { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.14, ease: EASE } }}
          className="max-w-[46rem] min-w-0"
        >
          <nav aria-label="Breadcrumb">
            <ol className="type-body-sm flex flex-wrap items-center gap-x-2 gap-y-1 text-ink/50">
              <li>
                <a href="/" onClick={inAppClick(() => lib.closeDetail(null))} className="transition-colors duration-300 hover:text-ink">
                  Peptide Library
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <a href={zoneHref(zone.id)} onClick={inAppClick(() => lib.closeDetail())} className="transition-colors duration-300 hover:text-ink">
                  {zone.name}
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-ink">
                {p.name}
              </li>
            </ol>
          </nav>
          <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0, behavior: "instant" })}>
            <motion.div key={p.slug} {...slide}>
              {ready ? (
                children
              ) : (
                <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading">
                  <Spinner className="size-5 text-ink/25" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
