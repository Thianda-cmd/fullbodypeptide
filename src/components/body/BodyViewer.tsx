"use client";

import { useEffect, useRef, useState } from "react";
import { ZONES, type ZoneId } from "@/lib/catalog";
import { frameBus, handles, type BodyModel } from "@/lib/store";
import { useReducedMotion } from "@/lib/hooks";
import { Spinner } from "@/components/ui/Spinner";
import type { BodyScene } from "./body-scene";

interface Props {
  zone: ZoneId | null;
  pinned: ZoneId | null;
  model: BodyModel;
  paused?: boolean;
  mobile?: boolean;
  onHoverZone?: (zone: ZoneId | null) => void;
  onPickZone?: (zone: ZoneId) => void;
  className?: string;
  /** applied to the canvas and poster only, so hotspots are never masked */
  canvasStyle?: React.CSSProperties;
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function BodyViewer({ zone, pinned, model, paused = false, mobile = false, onHoverZone, onPickZone, className, canvasStyle }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<BodyScene | null>(null);
  const dots = useRef<(HTMLDivElement | null)[]>([]);
  const [readyModel, setReadyModel] = useState<BodyModel | null>(null);
  const [failed, setFailed] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const reduced = useReducedMotion();
  const zoneRef = useRef(zone);
  zoneRef.current = zone;

  useEffect(() => setSupported(webglAvailable()), []);

  // create the scene once WebGL is known to work
  useEffect(() => {
    if (!supported || !canvas.current) return;
    let disposed = false;
    let instance: BodyScene | null = null;
    import("./body-scene").then(({ BodyScene }) => {
      if (disposed || !canvas.current) return;
      instance = new BodyScene(canvas.current, {
        reducedMotion: reduced,
        onReady: (m) => setReadyModel(m),
        onError: (err) => {
          console.error("[body] failed to load", err);
          setFailed(true);
        },
        onFrame: () => {
          const s = instance;
          if (!s) return;
          ZONES.forEach((z, i) => {
            const el = dots.current[i];
            const h = s.hotspots[z.id];
            if (!el || !h) return;
            el.style.transform = `translate3d(${h.x}px, ${h.y}px, 0)`;
            el.style.opacity = String(h.visible);
            el.style.visibility = h.visible < 0.05 ? "hidden" : "";
          });
          frameBus.emit();
        },
      });
      scene.current = instance;
      if (process.env.NODE_ENV !== "production") (window as unknown as { __body?: BodyScene }).__body = instance;
      handles.body = {
        hotspot: (z) => {
          const h = instance?.hotspots[z];
          const rect = wrap.current?.getBoundingClientRect();
          if (!h || !rect) return null;
          return { x: rect.left + h.x, y: rect.top + h.y, visible: h.visible };
        },
      };
      const r = wrap.current!.getBoundingClientRect();
      instance.resize(r.width, r.height);
      instance.setMobile(mobile);
      instance.setZone(zoneRef.current);
      instance.setModel(model);
    });
    return () => {
      disposed = true;
      instance?.dispose();
      scene.current = null;
      handles.body = null;
    };
    // the scene lives for the component's lifetime; props are pushed in below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  useEffect(() => {
    scene.current?.setModel(model);
  }, [model]);
  useEffect(() => {
    scene.current?.setZone(zone);
  }, [zone]);
  useEffect(() => {
    scene.current?.setMobile(mobile);
  }, [mobile]);
  useEffect(() => {
    scene.current?.setActive(!paused && inView && pageVisible);
  }, [paused, inView, pageVisible]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => scene.current?.resize(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    const vis = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", vis);
    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const shown = readyModel === model && !failed;
  const showPoster = supported === false || failed;

  return (
    <div ref={wrap} className={`overflow-hidden ${className ?? "relative"}`} style={{ touchAction: "pan-y" }}>
      {showPoster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/models/${model}-poster.webp`}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={canvasStyle}
          className="pointer-events-none absolute top-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2 select-none"
        />
      )}
      <canvas
        ref={canvas}
        aria-hidden="true"
        style={canvasStyle}
        className={`absolute inset-0 h-full w-full cursor-grab transition-opacity duration-700 ${shown ? "opacity-100" : "opacity-0"} ${mobile ? "pointer-events-none" : ""}`}
      />
      {!shown && !showPoster && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2.5">
          <Spinner className="size-6 text-ink/30" />
          <span role="status" className="text-[0.75rem] leading-4 text-ink/40">
            Loading the body
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-label="Body regions">
        {ZONES.map((z, i) => {
          const isActive = zone === z.id;
          const dim = zone !== null && !isActive;
          return (
            <div
              key={z.id}
              ref={(el) => {
                dots.current[i] = el;
              }}
              className="absolute top-0 left-0 will-change-transform"
              style={{ opacity: 0 }}
            >
              <button
                type="button"
                aria-label={z.name}
                aria-pressed={pinned === z.id}
                tabIndex={shown ? 0 : -1}
                onPointerEnter={(e) => e.pointerType === "mouse" && onHoverZone?.(z.id)}
                onPointerLeave={(e) => e.pointerType === "mouse" && onHoverZone?.(null)}
                onFocus={() => onHoverZone?.(z.id)}
                onBlur={() => onHoverZone?.(null)}
                onClick={() => onPickZone?.(z.id)}
                className={`group/dot absolute -top-5 -left-5 flex size-10 items-center justify-center transition-opacity duration-300 ${
                  shown ? "pointer-events-auto" : "pointer-events-none"
                } ${dim ? "opacity-35 hover:opacity-100" : "opacity-100"}`}
              >
                {!dim && (
                  <span
                    aria-hidden="true"
                    className="hotspot-ring absolute size-4 rounded-full border border-accent"
                    style={{ animationDelay: `${(i * 0.37) % 3.2}s` }}
                  />
                )}
                <span
                  aria-hidden="true"
                  className={`relative rounded-full border-[1.5px] border-paper bg-accent shadow-[0_0_0_4px_rgb(47_73_255/0.16)] transition-transform duration-300 ${
                    isActive ? "size-3 scale-110" : "size-2.5 group-hover/dot:scale-125"
                  }`}
                />
                <span
                  className={`type-body-xs pointer-events-none absolute top-1/2 left-9 -translate-y-1/2 rounded-full border border-line bg-paper/85 px-2.5 py-1 whitespace-nowrap text-ink shadow-[0_2px_10px_rgb(0_0_0/0.06)] backdrop-blur-md transition-[opacity,translate] duration-300 ${
                    isActive ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0 group-hover/dot:translate-x-0 group-hover/dot:opacity-100 group-focus-visible/dot:translate-x-0 group-focus-visible/dot:opacity-100"
                  }`}
                >
                  {z.name}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
