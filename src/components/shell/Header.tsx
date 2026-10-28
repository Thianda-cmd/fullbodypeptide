"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ZONES, ZONE_BY_ID, ZONE_COUNT, peptideHref, topInZone, type Peptide, type ZoneId } from "@/lib/catalog";
import { inAppClick } from "@/lib/measure";
import { onProgress } from "@/lib/progress";
import { Logo } from "@/components/brand/Logo";
import { Thumb } from "@/components/art/Thumb";
import { Count } from "@/components/ui/Dot";
import { ArrowRight } from "@/components/ui/Icons";
import { MobileSearch, SearchBox } from "@/components/search/Search";

const EASE = [0.16, 1, 0.3, 1] as const;
const PANEL_W = 600;
const zoneIndex = (z: ZoneId) => ZONES.findIndex((x) => x.id === z);

interface Props {
  active: ZoneId | null;
  pinned: ZoneId | null;
  onPickZone: (z: ZoneId) => void;
  onOpen: (p: Peptide) => void;
  onHome: () => void;
}

function PanelBody({ zone, dir, onOpen, onPickZone }: { zone: ZoneId; dir: number; onOpen: (p: Peptide) => void; onPickZone: (z: ZoneId) => void }) {
  const z = ZONE_BY_ID[zone];
  const top = topInZone(zone, 8);
  return (
    <motion.div
      initial={{ opacity: 0, x: dir * 24 }}
      animate={{ opacity: 1, x: 0, transition: { duration: 0.34, delay: dir === 0 ? 0 : 0.08, ease: EASE } }}
      exit={{ opacity: 0, x: dir * -16, transition: { duration: 0.1, ease: "easeIn" } }}
      className="flex flex-col [grid-area:1/1]"
    >
      <div className="flex items-start justify-between gap-6 px-6 pt-5 pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="type-body-lg text-ink">
            {z.name}
            <Count n={ZONE_COUNT[zone]} />
          </p>
          <p className="type-body-xs max-w-[22rem] text-ink/50">{z.blurb}</p>
        </div>
        <button
          type="button"
          onClick={() => onPickZone(zone)}
          className="type-body-sm group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[rgb(9_9_11/0.1)] px-3.5 text-ink transition-colors duration-200 hover:bg-haze"
        >
          Open the shelf
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-x-2 px-3.5 pb-4">
        {top.map((p) => (
          <li key={p.slug} className="min-w-0">
            <a
              href={peptideHref(p.slug)}
              onClick={inAppClick(() => onOpen(p))}
              className="group flex min-w-0 items-center gap-3 rounded-[0.25rem] px-2.5 py-2 transition-colors duration-200 hover:bg-haze"
            >
              <Thumb p={p} />
              <span className="flex min-w-0 flex-col">
                <span className="type-body-sm truncate text-ink">{p.name}</span>
                <span className="type-body-xs truncate text-ink/45">{p.cls || " "}</span>
              </span>
              <ArrowRight className="ml-auto size-3.5 shrink-0 -translate-x-1 text-ink/40 opacity-0 transition-[opacity,translate] duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
            </a>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export function Header({ active, pinned, onPickZone, onOpen, onHome }: Props) {
  const [panel, setPanel] = useState<{ zone: ZoneId; dir: number } | null>(null);
  const [pos, setPos] = useState<{ left: number; caret: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpen = useRef(false);
  isOpen.current = panel !== null;
  const row = useRef<HTMLDivElement>(null);
  const buttons = useRef<Partial<Record<ZoneId, HTMLButtonElement | null>>>({});
  const bar = useRef<HTMLSpanElement>(null);

  const showPanel = useCallback((zone: ZoneId) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setPanel((cur) => (cur?.zone === zone ? cur : { zone, dir: cur ? Math.sign(zoneIndex(zone) - zoneIndex(cur.zone)) : 0 })),
      isOpen.current ? 0 : 110,
    );
  }, []);
  const hidePanel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPanel(null), 180);
  }, []);
  const closeNow = () => {
    if (timer.current) clearTimeout(timer.current);
    setPanel(null);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useEffect(() => onProgress((v) => bar.current && (bar.current.style.transform = `scaleX(${v})`)), []);

  useLayoutEffect(() => {
    if (!panel) return;
    const r = row.current?.getBoundingClientRect();
    const b = buttons.current[panel.zone]?.getBoundingClientRect();
    if (!r || !b) return;
    const center = b.left + b.width / 2 - r.left;
    const left = Math.max(0, Math.min(r.width - PANEL_W, center - PANEL_W / 2));
    setPos({ left, caret: center - left });
  }, [panel]);

  const shown = panel?.zone ?? active;

  return (
    <header className="fixed inset-x-0 top-0 z-40" onPointerLeave={(e) => e.pointerType === "mouse" && hidePanel()}>
      <div className="relative z-[1] border-b border-[rgb(9_9_11/0.06)] bg-white/80 backdrop-blur-xl">
        <span
          ref={bar}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 origin-left bg-ink"
          style={{ transform: "scaleX(0)" }}
        />
        <div className="mx-auto flex h-16 w-full max-w-[96rem] items-center gap-6 px-6 md:px-10">
          <a
            href="/"
            onClick={inAppClick(() => {
              closeNow();
              onHome();
            })}
            className="flex shrink-0 items-center gap-3 text-ink"
            aria-label="Full Body Peptide Library, home"
          >
            <Logo />
            <span aria-hidden="true" className="h-4 w-px bg-ink/15" />
            <span className="text-[1.125rem] leading-none tracking-[-0.02em] whitespace-nowrap">Peptide Library</span>
          </a>
          <nav aria-label="Categories" className="min-w-0 flex-1 max-lg:hidden">
            <ul className="flex items-center justify-center">
              {ZONES.map((z) => {
                const on = shown === z.id;
                return (
                  <li key={z.id} className="relative">
                    {on && (
                      <motion.span
                        layoutId="nav-pill"
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full bg-mist"
                        transition={{ duration: 0.45, ease: EASE }}
                      />
                    )}
                    <button
                      ref={(el) => {
                        buttons.current[z.id] = el;
                      }}
                      type="button"
                      aria-pressed={pinned === z.id}
                      aria-expanded={panel?.zone === z.id}
                      onPointerEnter={(e) => e.pointerType === "mouse" && showPanel(z.id)}
                      onFocus={(e) => e.currentTarget.matches(":focus-visible") && showPanel(z.id)}
                      onClick={() => {
                        closeNow();
                        onPickZone(z.id);
                      }}
                      className={`type-body-sm relative z-[1] flex h-9 items-center rounded-full px-3 whitespace-nowrap transition-colors duration-300 ${
                        on ? "text-ink" : "text-ink/55 hover:text-ink"
                      }`}
                    >
                      {z.short}
                      <Count n={ZONE_COUNT[z.id]} className="ml-[0.25em]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <SearchBox
            onOpen={(p) => {
              closeNow();
              onOpen(p);
            }}
            onPickZone={(z) => {
              closeNow();
              onPickZone(z);
            }}
          />
          <MobileSearch onOpen={onOpen} onPickZone={onPickZone} />
        </div>
      </div>
      <div className="pointer-events-none mx-auto w-full max-w-[96rem] px-6 md:px-10">
        <div ref={row} className="relative">
          <AnimatePresence>
            {panel && pos && (
              <motion.div
                key="panel"
                data-wheel-ignore
                initial={{ opacity: 0, y: -6, scale: 0.98, x: pos.left }}
                animate={{ opacity: 1, y: 0, scale: 1, x: pos.left, transition: { default: { duration: 0.28, ease: EASE }, x: { duration: 0.42, ease: EASE } } }}
                exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.15 } }}
                style={{ width: PANEL_W, transformOrigin: `${pos.caret}px 0px` }}
                className="pointer-events-auto absolute top-2 left-0 max-lg:hidden"
                onPointerEnter={() => timer.current && clearTimeout(timer.current)}
              >
                <motion.div
                  layout
                  transition={{ layout: { duration: 0.42, ease: EASE } }}
                  className="grid overflow-hidden rounded-[0.5rem] border border-line bg-white shadow-[0_30px_60px_-20px_rgb(0_0_0/0.22),0_8px_20px_-12px_rgb(0_0_0/0.12)]"
                >
                  <AnimatePresence initial={false}>
                    <PanelBody
                      key={panel.zone}
                      zone={panel.zone}
                      dir={panel.dir}
                      onOpen={(p) => {
                        closeNow();
                        onOpen(p);
                      }}
                      onPickZone={(z) => {
                        closeNow();
                        onPickZone(z);
                      }}
                    />
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
