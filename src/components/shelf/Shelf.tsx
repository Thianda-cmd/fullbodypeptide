"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { CATEGORY_LABEL, peptideHref, type Category, type Peptide, type ZoneId } from "@/lib/catalog";
import { useReducedMotion } from "@/lib/hooks";
import type { ShelfHandle } from "@/lib/store";
import { ShelfScene, type ShelfEntry } from "./shelf-scene";

export type { ShelfEntry };

export interface ShelfApi extends ShelfHandle {
  drive(y: number, user: boolean): void;
}

interface Props {
  entries: ShelfEntry[];
  hiddenSlug?: string | null;
  running?: boolean;
  fit?: boolean;
  driven?: boolean;
  filter?: Category[];
  onOpen: (p: Peptide) => void;
  onHoverBook?: (p: Peptide | null) => void;
  onUserZone?: (zone: ZoneId) => void;
  onLength?: (scrollable: number) => void;
  onScrollRequest?: (y: number, instant: boolean) => void;
  onProgress?: (fraction: number) => void;
  className?: string;
  label?: string;
}

const artFor = (p: Peptide) => `/art/wide/${String(p.art).padStart(2, "0")}.webp`;

export const Shelf = forwardRef<ShelfApi, Props>(function Shelf(
  {
    entries,
    hiddenSlug = null,
    running = true,
    fit = false,
    driven = false,
    filter = [],
    onOpen,
    onHoverBook,
    onUserZone,
    onLength,
    onScrollRequest,
    onProgress,
    className = "",
    label = "Peptides",
  },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ShelfScene | null>(null);
  const reduced = useReducedMotion();
  // keep the latest callbacks without rebuilding the scene
  const cb = useRef({ onOpen, onHoverBook, onUserZone, onLength, onScrollRequest, onProgress });
  cb.current = { onOpen, onHoverBook, onUserZone, onLength, onScrollRequest, onProgress };

  useEffect(() => {
    if (!canvas.current || !wrap.current) return;
    const s = new ShelfScene(canvas.current, wrap.current, {
      fit,
      driven,
      reducedMotion: reduced,
      artSrc: artFor,
      onOpen: (p) => cb.current.onOpen(p),
      onHoverBook: (p) => cb.current.onHoverBook?.(p),
      onUserZone: (z) => cb.current.onUserZone?.(z),
      onLength: (n) => cb.current.onLength?.(n),
      onScrollRequest: (y, i) => cb.current.onScrollRequest?.(y, i),
      onProgress: (f) => cb.current.onProgress?.(f),
    });
    scene.current = s;
    s.setEntries(entries);
    return () => {
      s.dispose();
      scene.current = null;
    };
    // entries/flags are pushed below; the scene is created once per mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit]);

  useEffect(() => {
    scene.current?.setOptions({ driven, reducedMotion: reduced });
  }, [driven, reduced]);
  useEffect(() => {
    scene.current?.setEntries(entries);
  }, [entries]);
  useEffect(() => {
    scene.current?.setHidden(hiddenSlug);
  }, [hiddenSlug]);
  useEffect(() => {
    scene.current?.setRunning(running);
  }, [running]);
  useEffect(() => {
    scene.current?.setFilter(filter);
  }, [filter]);

  useImperativeHandle(
    ref,
    () => ({
      measure: (slug) => scene.current?.measure(slug) ?? null,
      reveal: (slug) => scene.current?.reveal(slug),
      scrollToZone: (zone, instant) => scene.current?.scrollToZone(zone, instant),
      anchor: (zone) => scene.current?.anchor(zone) ?? null,
      drive: (y, user) => scene.current?.drive(y, user),
    }),
    [],
  );

  return (
    <div
      ref={wrap}
      className={`relative ${className}`}
      style={{
        marginLeft: -36,
        ...(fit
          ? null
          : { maskImage: "linear-gradient(180deg, transparent 0, #000 28px, #000 calc(100% - 48px), transparent 100%)" }),
      }}
    >
      <canvas ref={canvas} aria-hidden="true" className={`absolute inset-0 h-full w-full ${driven ? "touch-pan-y" : "touch-none"}`} />
      <ul className="sr-only" aria-label={label}>
        {entries.map((e) =>
          e.kind === "book" ? (
            <li key={e.p.slug}>
              <a
                href={peptideHref(e.p.slug)}
                aria-label={`${e.p.name}, ${CATEGORY_LABEL[e.p.category]}`}
                onFocus={() => scene.current?.focusBook(e.p.slug)}
                onBlur={() => scene.current?.focusBook(null)}
                onClick={(ev) => {
                  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
                  ev.preventDefault();
                  onOpen(e.p);
                }}
              >
                {e.p.name}
              </a>
            </li>
          ) : (
            <li key={`zone-${e.zone.id}`} aria-hidden="true" />
          ),
        )}
      </ul>
    </div>
  );
});
