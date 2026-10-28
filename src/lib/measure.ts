import type { Measure } from "./store";

const rect = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/** Geometry of the detail card for a peptide, for the open/close flight. */
export function measureCard(slug: string): Measure | null {
  const el = document.querySelector(`[data-card="${CSS.escape(slug)}"]`);
  const name = el?.querySelector<HTMLElement>("[data-name]");
  if (!el || !name) return null;
  const prev = name.style.transform;
  name.style.transform = "none";
  const box = rect(el);
  const n = rect(name);
  name.style.transform = prev;
  const photo = el.querySelector("[data-card-photo]")?.getBoundingClientRect().height;
  return {
    box,
    radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0,
    name: { ...n, fs: parseFloat(getComputedStyle(name).fontSize) },
    photo: photo && box.h ? photo / box.h : undefined,
  };
}

/** Plain left-click without modifiers: handle in-app instead of following the href. */
export function inAppClick(fn: () => void) {
  return (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    fn();
  };
}
