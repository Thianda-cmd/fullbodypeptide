"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { BY_SLUG, CATEGORY_COLOR, artSrc } from "@/lib/catalog";
import type { Flight, Measure } from "@/lib/store";
import { artWidthFraction } from "@/components/shelf/geometry";
import { CARD_SHADOW, CARD_SHADOW_FLAT } from "@/components/detail/PeptideCard";

export const FLIGHT_SECONDS = 0.7;
const EASE = [0.22, 1, 0.36, 1] as const;

const frame = (m: Measure) => ({ left: m.box.x, top: m.box.y, width: m.box.w, height: m.box.h, borderRadius: m.radius });

/**
 * The box that travels between a shelf spine and the detail card. It cross-fades
 * from a spine (art panel beside a stripe) to a cover (art above a stripe) while
 * the card's own title animates along with it.
 */
export function FlightLayer({ flight, onDone }: { flight: Flight & { to: Measure }; onDone: () => void }) {
  const p = BY_SLUG.get(flight.slug);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  useEffect(() => {
    const t = setTimeout(finish, FLIGHT_SECONDS * 1000 + 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!p) return null;

  const open = flight.dir === "open";
  const spine = open ? flight.from : flight.to;
  const card = open ? flight.to : flight.from;
  const colors = CATEGORY_COLOR[p.category];

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed z-[5] overflow-hidden bg-white"
      initial={{ ...frame(flight.from), boxShadow: open ? CARD_SHADOW_FLAT : CARD_SHADOW }}
      animate={{ ...frame(flight.to), boxShadow: open ? CARD_SHADOW : CARD_SHADOW_FLAT }}
      transition={{ duration: FLIGHT_SECONDS, ease: EASE }}
      onAnimationComplete={finish}
    >
      {(["spine", "cover"] as const).map((layer) => {
        const appearing = (layer === "cover") === open;
        const isSpine = layer === "spine";
        return (
          <motion.div
            key={layer}
            className={`absolute inset-0 flex ${isSpine ? "flex-row" : "flex-col"}`}
            initial={{ opacity: appearing ? 0 : 1 }}
            animate={{ opacity: appearing ? 1 : 0 }}
            transition={
              appearing
                ? { duration: FLIGHT_SECONDS * 0.4, delay: FLIGHT_SECONDS * 0.12, ease: "easeOut" }
                : { duration: FLIGHT_SECONDS * 0.28, ease: "easeIn" }
            }
          >
            <div
              className="relative shrink-0 overflow-hidden"
              style={{
                backgroundColor: colors.tint,
                ...(isSpine ? { width: `${artWidthFraction(spine.box.w) * 100}%` } : { height: `${(card.photo ?? 0.62) * 100}%` }),
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artSrc(p)} alt="" draggable={false} className="absolute inset-0 size-full object-cover mix-blend-overlay" />
            </div>
            <span className="shrink-0" style={{ background: colors.line, ...(isSpine ? { width: 4 } : { height: 5 }) }} />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
