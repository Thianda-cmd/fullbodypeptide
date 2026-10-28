"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";

export const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", cb);
    return () => mql.removeEventListener("change", cb);
  };
}

/** Media query match; `fallback` is used during SSR and hydration. */
export function useMediaQuery(query: string, fallback = false) {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

export const useIsMobile = () => useMediaQuery("(max-width: 1023px)");
export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** True once mounted on the client. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** Element size via ResizeObserver. */
export function useSize<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// Pointer intent: a hover only counts when the mouse actually moved recently and
// the wheel is idle, so scrolling content under a still cursor doesn't trigger it.
const intent = { moved: 0, wheeled: 0 };
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "mouse" && (e.movementX || e.movementY)) intent.moved = performance.now();
    },
    { passive: true },
  );
  window.addEventListener("wheel", () => (intent.wheeled = performance.now()), { passive: true });
}
export const isDeliberateHover = () => {
  const now = performance.now();
  return now - intent.wheeled > 700 && now - intent.moved < 150;
};
