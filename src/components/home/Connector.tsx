"use client";

import { useEffect, useRef } from "react";
import type { ZoneId } from "@/lib/catalog";
import { frameBus, handles } from "@/lib/store";

/**
 * The elbow line from the active hotspot on the body to its heading on the shelf.
 * Follows both every frame without re-rendering React.
 */
export function Connector({ zone, container }: { zone: ZoneId | null; container: React.RefObject<HTMLElement | null> }) {
  const path = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!zone) return;
    const update = () => {
      const el = path.current;
      const box = container.current?.getBoundingClientRect();
      if (!el || !box) return;
      const hot = handles.body?.hotspot(zone);
      const anchor = handles.shelf?.anchor(zone);
      if (!hot || !anchor || hot.visible < 0.05) {
        el.style.opacity = "0";
        return;
      }
      el.style.opacity = String(hot.visible);
      const sx = hot.x - box.left;
      const sy = hot.y - box.top;
      const tx = anchor.x - box.left;
      const ty = anchor.y - box.top;
      const mid = Math.round(sx + (tx - sx) * 0.62) + 0.5;
      el.setAttribute("d", `M${sx},${sy} H${mid} V${ty} H${tx}`);
    };
    update();
    return frameBus.on(update);
  }, [zone, container]);

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] h-full w-full max-lg:hidden">
      {zone && <path key={zone} ref={path} className="connector" fill="none" stroke="rgb(23 23 26 / 0.26)" strokeWidth="1" style={{ opacity: 0 }} />}
    </svg>
  );
}
