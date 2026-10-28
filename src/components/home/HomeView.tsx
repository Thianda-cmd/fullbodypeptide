"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PEPTIDES, ZONES, peptidesInZone, type Peptide, type ZoneId } from "@/lib/catalog";
import { handles, ui, useUI, type BodyModel } from "@/lib/store";
import { setProgress } from "@/lib/progress";
import { isDeliberateHover } from "@/lib/hooks";
import { BodyViewer } from "@/components/body/BodyViewer";
import { Shelf, type ShelfApi, type ShelfEntry } from "@/components/shelf/Shelf";
import { MobileSearch } from "@/components/search/Search";
import { Rotate } from "@/components/ui/Icons";
import { Connector } from "./Connector";
import { Legend } from "./Legend";

const EASE = [0.16, 1, 0.3, 1] as const;

const ENTRIES: ShelfEntry[] = ZONES.flatMap((zone) => {
  const items = peptidesInZone(zone.id);
  return [{ kind: "zone" as const, zone, count: items.length }, ...items.map((p) => ({ kind: "book" as const, p }))];
});

const BODY_MASK: React.CSSProperties = {
  maskImage:
    "linear-gradient(180deg, #000 0, #000 84%, transparent 100%), linear-gradient(90deg, transparent 0, #000 12%, #000 88%, transparent 100%)",
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
};

function setChipFade(el: HTMLElement) {
  const max = el.scrollWidth - el.clientWidth;
  el.style.setProperty("--fade-l", el.scrollLeft > 2 ? "2rem" : "0px");
  el.style.setProperty("--fade-r", el.scrollLeft < max - 2 ? "2rem" : "0px");
}

function BodyToggle({ model }: { model: BodyModel }) {
  const set = (m: BodyModel) => {
    ui.set({ model: m });
    try {
      localStorage.setItem("fbp-body", m);
    } catch {}
  };
  return (
    <div className="pointer-events-auto absolute right-0 bottom-3 z-[3] flex items-center gap-3 max-lg:right-1 max-lg:bottom-2 lg:bottom-10">
      <span className="type-body-xs hidden items-center gap-1.5 text-ink/40 xl:inline-flex">
        <Rotate className="size-3.5" />
        Drag to rotate
      </span>
      <div role="radiogroup" aria-label="Body" className="flex rounded-full bg-mist p-0.5">
        {(["female", "male"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={model === m}
            onClick={() => set(m)}
            className={`type-body-xs relative h-7 rounded-full px-3 capitalize transition-colors duration-300 ${model === m ? "text-ink" : "text-ink/45 hover:text-ink/70"}`}
          >
            {model === m && (
              <motion.span layoutId="body-pill" className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.08)]" transition={{ duration: 0.35, ease: EASE }} />
            )}
            <span className="relative">{m}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  visible: boolean;
  active: ZoneId | null;
  openSlug: string | null;
  mobile: boolean;
  onHoverZone: (z: ZoneId | null) => void;
  onPickZone: (z: ZoneId, toggle?: boolean) => void;
  onOpen: (p: Peptide) => void;
  onUserZone: (z: ZoneId) => void;
  onHoldZone: () => void;
}

export function HomeView({ visible, active, openSlug, mobile, onHoverZone, onPickZone, onOpen, onUserZone, onHoldZone }: Props) {
  const model = useUI((s) => s.model);
  const pinned = useUI((s) => s.pinnedZone);
  const filter = useUI((s) => s.filter);
  const grid = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const shelfOuter = useRef<HTMLDivElement>(null);
  const shelfSticky = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLUListElement>(null);
  const shelf = useRef<ShelfApi>(null);
  const [shelfLength, setShelfLength] = useState(0);
  const pendingScroll = useRef<number | null>(null);

  // expose the shelf to the shell (flights, connector, zone jumps)
  useEffect(() => {
    handles.shelf = {
      measure: (s) => shelf.current?.measure(s) ?? null,
      reveal: (s) => shelf.current?.reveal(s),
      scrollToZone: (z, i) => shelf.current?.scrollToZone(z, i),
      anchor: (z) => shelf.current?.anchor(z) ?? null,
    };
    return () => {
      handles.shelf = null;
    };
  }, []);

  // phones: the page scroll drives the shelf, which stays pinned under the body
  useEffect(() => {
    const el = scroller.current;
    if (!mobile || !el) return;
    let offset = 0;
    const measure = () => {
      const outer = shelfOuter.current;
      const sticky = shelfSticky.current;
      if (!outer || !sticky) return;
      const top = parseFloat(getComputedStyle(sticky).top) || 0;
      offset = outer.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - top;
    };
    const onScroll = () => {
      if (pendingScroll.current !== null && Math.abs(el.scrollTop - pendingScroll.current) < 2) pendingScroll.current = null;
      shelf.current?.drive(Math.max(0, el.scrollTop - offset), pendingScroll.current === null);
      setProgress(el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight));
    };
    const onTouch = () => (pendingScroll.current = null);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (shelfOuter.current) ro.observe(shelfOuter.current);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchstart", onTouch, { passive: true });
    onScroll();
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", onTouch);
    };
  }, [mobile, shelfLength]);

  const scrollRequest = useCallback((y: number, instant: boolean) => {
    const el = scroller.current;
    const outer = shelfOuter.current;
    const sticky = shelfSticky.current;
    if (!el || !outer || !sticky) return;
    const top = parseFloat(getComputedStyle(sticky).top) || 0;
    const offset = outer.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - top;
    const target = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, offset + y));
    pendingScroll.current = instant ? null : target;
    el.scrollTo({ top: target, behavior: instant ? "instant" : "smooth" });
  }, []);

  // keep the active chip centred on phones
  useEffect(() => {
    const el = chips.current;
    if (!mobile || !el) return;
    setChipFade(el);
    const chip = active ? el.querySelector<HTMLElement>(`[data-zone="${active}"]`) : null;
    if (chip) el.scrollTo({ left: chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2, behavior: "smooth" });
  }, [active, mobile]);

  const hoverHotspot = useCallback(
    (z: ZoneId | null) => {
      if (z && !isDeliberateHover()) return;
      onHoverZone(z);
    },
    [onHoverZone],
  );

  // the spine stays hidden while its card is open or flying back, so the flight lands in its place
  const hidden = openSlug;
  const total = PEPTIDES.length;
  const entries = useMemo(() => ENTRIES, []);

  return (
    <motion.div
      ref={scroller}
      aria-hidden={!visible}
      inert={!visible}
      initial={false}
      animate={visible ? { opacity: 1, filter: "blur(0px)" } : { opacity: 0, filter: "blur(12px)" }}
      transition={{ duration: visible ? 0.6 : 0.5, ease: EASE }}
      className={`no-scrollbar fixed inset-0 z-0 overflow-y-auto bg-white lg:overflow-hidden ${visible ? "" : "pointer-events-none"}`}
    >
      <div
        ref={grid}
        className="relative mx-auto flex min-h-full w-full max-w-[96rem] flex-col px-6 pt-20 md:px-10 lg:grid lg:h-svh lg:min-h-[44rem] lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)_minmax(24rem,30rem)] lg:gap-6 lg:pt-16 lg:pb-8"
      >
        <Connector zone={visible && !mobile ? active : null} container={grid} />

        <div className="relative z-[3] flex flex-col gap-4 pb-6 lg:justify-center lg:pb-0">
          <div className="flex flex-col gap-4">
            <p className="type-label text-ink/40">Peptide library · {total} entries</p>
            <h1 className="type-heading-sm max-w-[18rem] font-normal text-ink">Where every peptide works in the body.</h1>
            <p className="type-body-md max-w-[19.5rem] text-ink/55">
              {total} peptides, from FDA-approved drugs to trial candidates, gray-market compounds and skincare actives, sorted by
              where they act.
            </p>
          </div>
          <Legend filter={filter} onChange={(f) => ui.set({ filter: f })} className="lg:absolute lg:bottom-0 lg:left-0" />
        </div>

        <div className="sticky top-16 z-[4] -mx-6 bg-white px-6 md:-mx-10 md:px-10 lg:static lg:mx-0 lg:flex lg:min-h-0 lg:flex-col lg:bg-transparent lg:px-0">
          <ul
            ref={chips}
            aria-label="Zones"
            onScroll={(e) => setChipFade(e.currentTarget)}
            className="no-scrollbar fade-x relative z-[3] -mx-6 flex h-14 items-center gap-1.5 overflow-x-auto px-6 md:-mx-10 md:px-10 lg:hidden"
          >
            {ZONES.map((z) => {
              const on = active === z.id;
              return (
                <li key={z.id} data-zone={z.id} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={pinned === z.id}
                    onClick={() => onPickZone(z.id, false)}
                    className={`type-body-sm inline-flex h-9 items-center rounded-full border px-3.5 whitespace-nowrap transition-colors duration-300 ${
                      on ? "border-transparent bg-ink text-white" : "border-[rgb(9_9_11/0.1)] bg-white text-ink"
                    }`}
                  >
                    {z.short}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="relative h-[32svh] w-full lg:h-auto lg:min-h-0 lg:flex-1" onPointerLeave={(e) => e.pointerType === "mouse" && onHoverZone(null)}>
            <div className="absolute inset-x-0 top-0 bottom-0 lg:-bottom-8">
              <BodyViewer
                zone={active}
                pinned={pinned}
                model={model}
                paused={!visible}
                mobile={mobile}
                onHoverZone={hoverHotspot}
                onPickZone={(z) => onPickZone(z, true)}
                canvasStyle={BODY_MASK}
                className="absolute inset-0"
              />
            </div>
            <BodyToggle model={model} />
          </div>
          <div className="-mx-2 py-2 lg:hidden">
            <MobileSearch variant="bar" onOpen={onOpen} onPickZone={(z) => onPickZone(z, false)} />
          </div>
        </div>

        <div
          className="relative z-[3] flex min-h-0 flex-col lg:-mr-4 lg:pt-4"
          onPointerEnter={onHoldZone}
          onPointerLeave={(e) => e.pointerType === "mouse" && onHoverZone(null)}
        >
          <div
            ref={shelfOuter}
            className="lg:min-h-0 lg:flex-1"
            style={mobile ? { height: `calc(100svh - 11.5rem - 32svh + ${shelfLength}px)` } : undefined}
          >
            <div ref={shelfSticky} className="sticky top-[calc(11.5rem+32svh)] h-[calc(100svh-11.5rem-32svh)] lg:static lg:h-full">
              <Shelf
                ref={shelf}
                entries={entries}
                hiddenSlug={hidden}
                running={visible}
                driven={mobile}
                filter={filter}
                onOpen={onOpen}
                onUserZone={onUserZone}
                onLength={setShelfLength}
                onScrollRequest={scrollRequest}
                onProgress={mobile ? undefined : setProgress}
                className="h-full"
                label="All peptides, by body zone"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
