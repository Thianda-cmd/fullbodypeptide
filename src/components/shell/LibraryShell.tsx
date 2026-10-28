"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BY_SLUG, isZoneId, peptideHref, type Peptide, type ZoneId } from "@/lib/catalog";
import { handles, ui, useUI, type Measure } from "@/lib/store";
import { measureCard } from "@/lib/measure";
import { useIsMobile, useIsoLayoutEffect } from "@/lib/hooks";
import { HomeView } from "@/components/home/HomeView";
import { DetailFrame } from "@/components/detail/DetailFrame";
import type { CardFlight } from "@/components/detail/PeptideCard";
import { FLIGHT_SECONDS, FlightLayer } from "@/components/flight/Flight";
import { Header } from "./Header";
import { LibraryContext, type LibraryActions } from "./library-context";

const slugFromPath = (p: string | null) => {
  const m = p?.match(/^\/peptides\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

const onScreen = (m: Measure) => m.box.y + m.box.h > 0 && m.box.y < window.innerHeight && m.box.w > 0;

export function LibraryShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const routeSlug = slugFromPath(pathname);
  const mobile = useIsMobile();
  const pending = useUI((s) => s.pending);
  const closing = useUI((s) => s.closing);
  const flight = useUI((s) => s.flight);
  const hoverZone = useUI((s) => s.hoverZone);
  const scrollZone = useUI((s) => s.scrollZone);
  const pinnedZone = useUI((s) => s.pinnedZone);
  const [homeForced, setHomeForced] = useState(false);

  // the optimistic slug wins until the URL catches up
  const openSlug = pending !== undefined ? pending : routeSlug;
  const open = openSlug ? (BY_SLUG.get(openSlug) ?? null) : null;
  const active = open?.zone ?? hoverZone ?? scrollZone ?? pinnedZone;
  const homeVisible = !open || homeForced;

  const openRef = useRef(openSlug);
  openRef.current = openSlug;
  const flightId = useRef(0);
  const pendingOpen = useRef<{ slug: string; from: Measure } | null>(null);
  const closeCtx = useRef<{ slug: string; from: Measure; zone: ZoneId | null } | null>(null);
  const closeTarget = useRef<ZoneId | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimers = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };

  // ---------------------------------------------------------------- URL -> state

  useIsoLayoutEffect(() => {
    if (ui.get().pending !== undefined) ui.set({ pending: undefined, closing: false });
  }, [routeSlug]);

  useEffect(() => {
    if (routeSlug) return;
    const z = new URLSearchParams(window.location.search).get("z");
    if (isZoneId(z)) {
      ui.set({ pinnedZone: z, scrollZone: null });
      handles.shelf?.scrollToZone(z, true);
    }
  }, [routeSlug]);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("body");
      const saved = q ?? localStorage.getItem("fbp-body");
      if (saved === "male" || saved === "female") ui.set({ model: saved });
    } catch {}
  }, []);

  // ---------------------------------------------------------------- actions

  const finishClose = useCallback(
    (zone: ZoneId | null) => {
      ui.set({ pending: null, closing: false, flight: null, pinnedZone: zone, hoverZone: null, scrollZone: null });
      setHomeForced(false);
      router.push(zone ? `/?z=${zone}` : "/", { scroll: false });
    },
    [router],
  );

  const closeDetail = useCallback(
    (zone?: ZoneId | null) => {
      const slug = openRef.current;
      if (!slug || ui.get().closing) return;
      const p = BY_SLUG.get(slug);
      const target = zone === undefined ? (p?.zone ?? null) : zone;
      ui.set({ closing: true });
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        const from = measureCard(slug);
        if (!from) return finishClose(target);
        closeCtx.current = { slug, from, zone: target };
        setHomeForced(true);
      }, 170);
    },
    [finishClose],
  );

  // once the library is showing again behind the card, fly the card back onto its spine
  useIsoLayoutEffect(() => {
    const c = closeCtx.current;
    if (!homeForced || !c) return;
    closeCtx.current = null;
    if (c.zone) ui.set({ pinnedZone: c.zone, scrollZone: null, hoverZone: null });
    handles.shelf?.reveal(c.slug);
    const to = handles.shelf?.measure(c.slug);
    if (!to || !onScreen(to)) return finishClose(c.zone);
    closeTarget.current = c.zone;
    ui.set({ flight: { id: ++flightId.current, slug: c.slug, dir: "close", from: c.from, to } });
  }, [homeForced]);

  const openPeptide = useCallback(
    (p: Peptide) => {
      clearTimers();
      const current = openRef.current;
      if (current === p.slug || ui.get().closing) return;
      const from = !current ? handles.shelf?.measure(p.slug) : null;
      pendingOpen.current = from && onScreen(from) ? { slug: p.slug, from } : null;
      ui.set({ pending: p.slug, hoverZone: null, closing: false });
      router.push(peptideHref(p.slug), { scroll: false });
    },
    [router],
  );

  // the card is in the DOM as soon as the optimistic slug renders: start the flight
  useIsoLayoutEffect(() => {
    const po = pendingOpen.current;
    if (!po || po.slug !== openSlug) return;
    pendingOpen.current = null;
    const to = measureCard(po.slug);
    if (to) ui.set({ flight: { id: ++flightId.current, slug: po.slug, dir: "open", from: po.from, to } });
  }, [openSlug]);

  const onFlightDone = useCallback(() => {
    const f = ui.get().flight;
    if (!f) return;
    if (f.dir === "close") finishClose(closeTarget.current);
    else ui.set({ flight: null });
  }, [finishClose]);

  const pickZone = useCallback(
    (z: ZoneId, toggle = false) => {
      clearTimers();
      if (openRef.current) return closeDetail(z);
      const unpin = toggle && ui.get().pinnedZone === z;
      ui.set({ hoverZone: null, scrollZone: null, pinnedZone: unpin ? null : z });
      if (!unpin) handles.shelf?.scrollToZone(z);
      window.history.replaceState(null, "", unpin ? "/" : `/?z=${z}`);
    },
    [closeDetail],
  );

  const goHome = useCallback(() => {
    clearTimers();
    if (openRef.current) return closeDetail(null);
    ui.set({ hoverZone: null, scrollZone: null, pinnedZone: null });
    window.history.replaceState(null, "", "/");
  }, [closeDetail]);

  const onHoverZone = useCallback((z: ZoneId | null) => {
    clearTimers();
    if (z) {
      hoverTimer.current = setTimeout(() => {
        ui.set({ hoverZone: z });
        handles.shelf?.scrollToZone(z);
      }, 90);
    } else leaveTimer.current = setTimeout(() => ui.set({ hoverZone: null }), 500);
  }, []);

  const onUserZone = useCallback((z: ZoneId) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    ui.set({ hoverZone: null, scrollZone: z });
  }, []);

  const onHoldZone = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openRef.current && !(e.target as HTMLElement)?.closest?.("input, [role=dialog]")) closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDetail]);

  const actions = useMemo<LibraryActions>(() => ({ openPeptide, closeDetail, pickZone }), [openPeptide, closeDetail, pickZone]);

  const cardFlight = useMemo<CardFlight | null>(() => {
    if (!flight?.to || flight.slug !== openSlug) return null;
    const spine = flight.dir === "open" ? flight.from : flight.to;
    return { id: flight.id, dir: flight.dir, spine: spine.name, duration: FLIGHT_SECONDS };
  }, [flight, openSlug]);

  return (
    <LibraryContext.Provider value={actions}>
      <main className="min-h-svh text-ink">
        <Header active={active} pinned={pinnedZone} onPickZone={(z) => pickZone(z, false)} onOpen={openPeptide} onHome={goHome} />
        <HomeView
          visible={homeVisible}
          active={active}
          openSlug={openSlug}
          mobile={mobile}
          onHoverZone={onHoverZone}
          onPickZone={pickZone}
          onOpen={openPeptide}
          onUserZone={onUserZone}
          onHoldZone={onHoldZone}
        />
        {open ? (
          <DetailFrame p={open} ready={routeSlug === open.slug} closing={closing} flight={cardFlight}>
            {children}
          </DetailFrame>
        ) : (
          children
        )}
        {flight?.to && <FlightLayer key={flight.id} flight={{ ...flight, to: flight.to }} onDone={onFlightDone} />}
      </main>
    </LibraryContext.Provider>
  );
}
