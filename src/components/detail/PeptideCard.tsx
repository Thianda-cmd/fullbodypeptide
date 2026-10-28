"use client";

import { AnimatePresence, animate, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CATEGORY_COLOR, CATEGORY_LABEL, EVIDENCE_LABEL, ZONE_BY_ID, artSrc, splitName, type Peptide } from "@/lib/catalog";
import { Dot } from "@/components/ui/Dot";

const EASE_FLIGHT = [0.22, 1, 0.36, 1] as const;
const EASE = [0.16, 1, 0.3, 1] as const;
export const CARD_SHADOW = "inset 0px 0px 0px 1px rgba(9,9,11,0.07), 0px 40px 80px -40px rgba(0,0,0,0.3)";
export const CARD_SHADOW_FLAT = "inset 0px 0px 0px 1px rgba(9,9,11,0.07), 0px 0px 0px 0px rgba(0,0,0,0)";

export interface CardFlight {
  id: number;
  dir: "open" | "close";
  spine: { x: number; y: number; fs: number };
  duration: number;
}

function nameSize(name: string) {
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length));
  if (name.length <= 10 && longest <= 10) return "type-heading-xl";
  if (longest <= 13 && name.length <= 22) return "type-heading-lg";
  return "type-heading-md";
}

export function EvidenceMeter({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`h-2.5 w-[5px] rounded-[1.5px] ${i <= level ? "bg-ink/80" : "bg-ink/12"}`} />
      ))}
    </span>
  );
}

const slide = {
  initial: { opacity: 0, x: -36 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } },
  exit: { opacity: 0, x: 36, transition: { duration: 0.2, ease: "easeIn" as const } },
};

export function PeptideCard({ p, flight, closing }: { p: Peptide; flight: CardFlight | null; closing: boolean }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const name = useRef<HTMLSpanElement>(null);
  const anim = useRef<{ stop: () => void } | null>(null);
  const flying = flight !== null;
  const colors = CATEGORY_COLOR[p.category];
  const { base, qualifier } = splitName(p.name);
  const sub = p.brands.length ? p.brands.slice(0, 3).join(" · ") : p.aliases.length ? `Also called ${p.aliases.slice(0, 2).join(", ")}` : null;

  useEffect(() => () => anim.current?.stop(), []);
  useLayoutEffect(() => {
    const el = name.current;
    if (!flight || !el) return;
    anim.current?.stop();
    el.style.transform = "none";
    const r = el.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const spine = { x: flight.spine.x - r.left, y: flight.spine.y - r.top, scale: flight.spine.fs / fs };
    const rest = { x: 0, y: 0, scale: 1 };
    const [from, to] = flight.dir === "open" ? [spine, rest] : [rest, spine];
    el.style.transformOrigin = "0 0";
    el.style.transform = `translate(${from.x}px, ${from.y}px) scale(${from.scale})`;
    anim.current = animate(el, { x: [from.x, to.x], y: [from.y, to.y], scale: [from.scale, to.scale] }, { duration: flight.duration, ease: EASE_FLIGHT });
  }, [flight]);

  const fade = `transition-opacity ease-out ${closing ? "opacity-0 duration-150" : flying ? "opacity-0 duration-0" : "opacity-100 duration-500"}`;
  const art = flying ? "opacity-0" : "opacity-100";

  return (
    <div
      className="relative h-full [perspective:1600px]"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || flying) return;
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -3, y: ((e.clientX - r.left) / r.width - 0.5) * 4 });
      }}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div
        className="h-full transition-transform duration-[600ms] ease-[cubic-bezier(.16,1,.3,1)]"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <div
          data-card={p.slug}
          className={`relative flex h-full flex-col rounded-[6px] ${flying ? "overflow-visible" : "overflow-hidden bg-white"}`}
          style={flying ? undefined : { boxShadow: CARD_SHADOW }}
        >
          <div
            data-card-photo=""
            className={`relative min-h-0 flex-1 overflow-hidden transition-colors duration-500 ${art}`}
            style={{ backgroundColor: colors.tint }}
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={p.slug}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={artSrc(p)} alt="" draggable={false} className="absolute inset-0 size-full object-cover mix-blend-soft-light" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={artSrc(p)} alt="" draggable={false} className="absolute inset-0 size-full object-cover opacity-55 mix-blend-screen" />
              </motion.div>
            </AnimatePresence>
            <div className="grain pointer-events-none absolute inset-0 opacity-60 mix-blend-multiply" />
          </div>
          <span aria-hidden="true" className={`shrink-0 transition-colors duration-500 ${art}`} style={{ height: 5, background: colors.line }} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={p.slug} {...slide} className="flex shrink-0 flex-col gap-5 px-6 pt-5 pb-6 lg:px-8 lg:pt-6 lg:pb-8">
              <div className={`flex items-start justify-between gap-6 ${fade}`}>
                <p className="type-body-sm inline-flex items-center gap-2 text-ink">
                  <Dot c={p.category} />
                  {CATEGORY_LABEL[p.category]}
                </p>
                <p className="type-body-sm text-right text-ink">{ZONE_BY_ID[p.zone].name}</p>
              </div>
              <div className="flex flex-col gap-2">
                <h1 className={`${nameSize(base)} font-normal text-ink [text-wrap:balance]`}>
                  <span ref={name} data-name="" className="inline-block will-change-transform">
                    {base}
                  </span>
                  {qualifier && <span className={`type-body-md ml-2 align-middle text-ink/45 ${fade}`}>({qualifier})</span>}
                </h1>
                {sub && <p className={`type-body-xs text-ink/50 ${fade}`}>{sub}</p>}
              </div>
              <div className={`grid grid-cols-2 gap-4 ${fade}`}>
                <div className="flex flex-col gap-1">
                  <span className="type-body-xs text-ink/45">Evidence</span>
                  <span className="type-body-sm inline-flex items-center gap-2 text-ink">
                    <EvidenceMeter level={p.evidence} />
                    {EVIDENCE_LABEL[p.evidence]}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="type-body-xs text-ink/45">Class</span>
                  <span className="type-body-sm text-ink">{p.cls || "—"}</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
