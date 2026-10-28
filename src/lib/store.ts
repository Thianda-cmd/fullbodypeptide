"use client";

import { useSyncExternalStore } from "react";
import type { Category, ZoneId } from "./catalog";

export type BodyModel = "female" | "male";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Geometry of a peptide as either a shelf spine or a detail card, for the open/close flight. */
export interface Measure {
  box: Box;
  radius: number;
  /** where the name text sits, and its font size */
  name: Box & { fs: number };
  /** fraction of the card height taken by the artwork (card only) */
  photo?: number;
}

export interface Flight {
  id: number;
  slug: string;
  dir: "open" | "close";
  from: Measure;
  to: Measure | null;
}

export interface UIState {
  /** zone under the pointer in the nav, hotspots or mega menu */
  hoverZone: ZoneId | null;
  /** zone heading at the top of the shelf while the user scrolls it */
  scrollZone: ZoneId | null;
  /** zone chosen by click or ?z= */
  pinnedZone: ZoneId | null;
  /**
   * Optimistic open peptide, set on click before the navigation commits.
   * undefined: follow the URL; null: closed; string: open.
   */
  pending: string | null | undefined;
  closing: boolean;
  model: BodyModel;
  /** statuses shown on the shelf; empty means all */
  filter: Category[];
  flight: Flight | null;
  searchOpen: boolean;
}

type Listener = () => void;

function createStore<T extends object>(initial: T) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const next = typeof patch === "function" ? patch(state) : patch;
      let changed = false;
      for (const k in next) if (!Object.is(next[k], state[k])) changed = true;
      if (!changed) return;
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const ui = createStore<UIState>({
  hoverZone: null,
  scrollZone: null,
  pinnedZone: null,
  pending: undefined,
  closing: false,
  model: "female",
  filter: [],
  flight: null,
  searchOpen: false,
});

export function useUI<S>(select: (s: UIState) => S): S {
  return useSyncExternalStore(
    ui.subscribe,
    () => select(ui.get()),
    () => select(ui.get()),
  );
}

/** The zone the body, nav and connector should show right now. */
export function activeZoneOf(s: UIState, openZone: ZoneId | null): ZoneId | null {
  return openZone ?? s.hoverZone ?? s.scrollZone ?? s.pinnedZone;
}

// ---------------------------------------------------------------- imperative handles

export interface ShelfHandle {
  measure(slug: string): Measure | null;
  reveal(slug: string): void;
  scrollToZone(zone: ZoneId, instant?: boolean): void;
  /** screen position of a zone heading's left edge, if visible */
  anchor(zone: ZoneId): { x: number; y: number } | null;
}

export interface BodyHandle {
  /** screen position + visibility of a zone hotspot */
  hotspot(zone: ZoneId): { x: number; y: number; visible: number } | null;
}

export const handles: { shelf: ShelfHandle | null; body: BodyHandle | null } = { shelf: null, body: null };

// ---------------------------------------------------------------- per-frame bus
// The body scene publishes after each rendered frame so DOM overlays (hotspots,
// connector) can follow without React re-renders.

const frameListeners = new Set<() => void>();
export const frameBus = {
  emit: () => frameListeners.forEach((f) => f()),
  on(f: () => void) {
    frameListeners.add(f);
    return () => void frameListeners.delete(f);
  },
};
