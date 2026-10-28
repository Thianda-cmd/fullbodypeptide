import * as THREE from "three";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  splitName,
  type Peptide,
  type Zone,
  type ZoneId,
} from "@/lib/catalog";
import type { Measure } from "@/lib/store";
import { artWidthFraction } from "./geometry";

export type ShelfEntry = { kind: "zone"; zone: Zone; count: number } | { kind: "book"; p: Peptide };

// layout, in CSS pixels
export const BOOK_H = 58;
const BOOK_GAP = 40;
export const BOOK_DEPTH = 124;
const HEAD_H = 48;
const HEAD_BEFORE = 26;
const HEAD_AFTER = 30;
const FIT_PAD = 72;
const NAME_PX = 16;
const NAME_TOP = 12;
const META_PX = 11;
const FOV = 50;
const HOVER_SHIFT = -18;

// reveal animation
const REVEAL_MS = 720;
const REVEAL_JITTER = 260;
const REVEAL_SPREAD = 220;
const REVEAL_X = 260;

const textLeft = (w: number) => Math.round(w * artWidthFraction(w)) + 4 + 16;

const rand = (n: number) => {
  const t = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return t - Math.floor(t);
};

function mixWhite(hex: string, amount: number) {
  const c = new THREE.Color(hex);
  return c.lerp(new THREE.Color(1, 1, 1), 1 - amount);
}

function insets(fit: boolean, driven: boolean) {
  if (driven) return { l: 36, r: 0 };
  const l = fit ? 36 : 58;
  const r = fit ? 2 : 22;
  return { l, r };
}

// ---------------------------------------------------------------- textures

const artCache = new Map<string, HTMLImageElement>();
export function loadArt(src: string) {
  let img = artCache.get(src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = src;
    artCache.set(src, img);
  }
  return img.complete ? Promise.resolve(img) : img.decode().then(() => img!, () => img!);
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, seed: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  // pick a different slice of the artwork per book
  const ox = (w - dw) * rand(seed + 3);
  const oy = (h - dh) * rand(seed + 9);
  ctx.drawImage(img, ox, oy, dw, dh);
}

function spineTexture(p: Peptide, w: number, dpr: number, font: string, art: HTMLImageElement | null) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(BOOK_H * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const colors = CATEGORY_COLOR[p.category];
  const panel = Math.round(w * artWidthFraction(w));

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, BOOK_H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, panel, BOOK_H);
  ctx.clip();
  ctx.fillStyle = colors.tint;
  ctx.fillRect(0, 0, panel, BOOK_H);
  if (art?.complete && art.naturalWidth) {
    ctx.globalCompositeOperation = "overlay";
    drawCover(ctx, art, panel, BOOK_H, p.art);
  }
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = colors.line;
  ctx.fillRect(panel, 0, 4, BOOK_H);

  const x = textLeft(w);
  const maxW = w - x - 14;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#17171a";
  ctx.font = `400 ${NAME_PX}px ${font}`;
  const { base, qualifier } = splitName(p.name);
  let name = qualifier ? `${base} (${qualifier})` : base;
  if (ctx.measureText(name).width > maxW) {
    name = base;
    while (name.length > 1 && ctx.measureText(`${name}…`).width > maxW) name = name.slice(0, -1);
    if (name !== base) name = `${name.trimEnd()}…`;
  }
  ctx.fillText(name, x, NAME_TOP);
  const nameW = ctx.measureText(name).width;

  ctx.font = `400 ${META_PX}px ${font}`;
  ctx.fillStyle = "rgba(23,23,26,0.5)";
  let meta = CATEGORY_LABEL[p.category];
  if (p.cls) {
    const full = `${meta}  ·  ${p.cls}`;
    if (ctx.measureText(full).width <= maxW) meta = full;
  }
  ctx.fillText(meta, x, NAME_TOP + NAME_PX * 1.2 + 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return { tex, nameW };
}

function headingTexture(zone: Zone, count: number, w: number, dpr: number, font: string) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(HEAD_H * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#17171a";
  ctx.font = `400 24px ${font}`;
  ctx.fillText(zone.name, 2, 34);
  const nw = ctx.measureText(zone.name).width;
  ctx.fillStyle = "rgba(23,23,26,0.38)";
  ctx.fillText(`(${count})`, nw + 8, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

// ---------------------------------------------------------------- scene

interface Item {
  entry: ShelfEntry;
  top: number;
  h: number;
  mesh: THREE.Mesh;
  mats: THREE.Material[];
  offX: number;
  dim: number;
  nameW: number;
  lag: number;
  hidden: number;
}

export interface ShelfOptions {
  fit?: boolean;
  driven?: boolean;
  reducedMotion?: boolean;
  artSrc: (p: Peptide) => string;
  onOpen: (p: Peptide) => void;
  onHoverBook?: (p: Peptide | null) => void;
  onUserZone?: (zone: ZoneId) => void;
  onLength?: (scrollable: number) => void;
  onScrollRequest?: (y: number, instant: boolean) => void;
  onProgress?: (fraction: number) => void;
}

export class ShelfScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 1, 8000);
  private stack = new THREE.Group();
  private items: Item[] = [];
  private entries: ShelfEntry[] = [];
  private w = 0;
  private h = 0;
  private contentH = 0;
  private scroll = 0;
  private target = 0;
  private trail = 0;
  private pageY = NaN;
  private user = false;
  private hovered = -1;
  private hiddenSlug: string | null = null;
  private filter: Set<string> | null = null;
  private zoneInView: ZoneId | null = null;
  private revealAt: number | null = null;
  private fontsReady = false;
  private running = true;
  private raf = 0;
  private last = 0;
  private drawn = "";
  private viewKey = NaN;
  private version = 0;
  private dragging: { y: number; x: number; scroll: number; moved: boolean } | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private ro: ResizeObserver;
  private pendingZone: { zone: ZoneId; instant: boolean } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private container: HTMLElement,
    private opts: ShelfOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xffffff, 0);
    this.scene.add(this.stack);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();

    const ready = () => {
      if (this.fontsReady) return;
      this.fontsReady = true;
      this.build();
    };
    (document.fonts?.ready ?? Promise.resolve()).then(ready);
    setTimeout(ready, 1200);

    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerCancel);
    window.addEventListener("wheel", this.onWheel, { passive: false });
    this.raf = requestAnimationFrame(this.tick);
  }

  // ---------------------------------------------------------------- public

  setEntries(entries: ShelfEntry[]) {
    this.entries = entries;
    this.build();
  }

  setHidden(slug: string | null) {
    this.hiddenSlug = slug;
  }

  setFilter(categories: string[]) {
    this.filter = categories.length ? new Set(categories) : null;
  }

  setRunning(running: boolean) {
    this.running = running;
    if (running) this.last = 0;
  }

  setOptions(patch: Partial<ShelfOptions>) {
    this.opts = { ...this.opts, ...patch };
  }

  /** Re-draw spines once their artwork has loaded. */
  refreshArt() {
    this.build();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerCancel);
    window.removeEventListener("wheel", this.onWheel);
    this.clear();
    this.renderer.dispose();
  }

  get maxScroll() {
    return Math.max(0, this.contentH - this.h + 40);
  }

  measure(slug: string): Measure | null {
    const it = this.items.find((i) => i.entry.kind === "book" && i.entry.p.slug === slug);
    if (!it) return null;
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld();
    const { l, r } = insets(!!this.opts.fit, !!this.opts.driven);
    const width = this.w - l - r;
    const at = (x: number, y: number) => this.toScreen(it.mesh.localToWorld(new THREE.Vector3(x, y, BOOK_DEPTH / 2)));
    const a = at(-width / 2, BOOK_H / 2);
    const b = at(width / 2, -BOOK_H / 2);
    const box = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    const s = box.h / BOOK_H;
    const n = at(-width / 2 + textLeft(width), BOOK_H / 2 - NAME_TOP);
    return { box, radius: 2, name: { x: n.x, y: n.y, w: it.nameW * s, h: NAME_PX * 1.2 * s, fs: NAME_PX * s } };
  }

  /** Jump so the given book is comfortably on screen (used before a closing flight). */
  reveal(slug: string) {
    const it = this.items.find((i) => i.entry.kind === "book" && i.entry.p.slug === slug);
    if (!it) return;
    if (it.top - this.scroll > 60 && it.top + BOOK_H - this.scroll < this.h - 80) return;
    const y = Math.min(this.maxScroll, Math.max(0, it.top - this.h / 2 + BOOK_H / 2));
    this.target = this.scroll = this.trail = y;
    if (this.opts.driven) this.opts.onScrollRequest?.(y, true);
    for (const i of this.items) {
      i.lag = this.scroll;
      i.mesh.position.y = this.yOf(i) + this.scroll;
    }
  }

  scrollToZone(zone: ZoneId, instant = false) {
    const it = this.items.find((i) => i.entry.kind === "zone" && i.entry.zone.id === zone);
    if (!it) {
      // not built yet (fonts still loading): apply once the books exist
      if (!this.items.length) this.pendingZone = { zone, instant };
      return;
    }
    this.pendingZone = null;
    const y = Math.min(this.maxScroll, Math.max(0, it.top - 30));
    this.user = false;
    if (this.opts.driven) {
      this.opts.onScrollRequest?.(y, instant);
      if (!instant) return;
    }
    this.target = y;
    if (instant) {
      this.scroll = this.trail = y;
      for (const i of this.items) i.lag = y;
    }
  }

  /** External scroll position (mobile, where the page scroll drives the shelf). */
  drive(y: number, user: boolean) {
    this.target = Math.min(this.maxScroll, Math.max(0, y));
    this.user = user;
  }

  anchor(zone: ZoneId) {
    const it = this.items.find((i) => i.entry.kind === "zone" && i.entry.zone.id === zone);
    if (!it) return null;
    const y = it.top + 26 - it.lag;
    if (y < 0 || y > this.h) return null;
    this.scene.updateMatrixWorld(true);
    const { l, r } = insets(!!this.opts.fit, !!this.opts.driven);
    const width = this.w - l - r;
    return this.toScreen(it.mesh.localToWorld(new THREE.Vector3(-width / 2 - 10, HEAD_H / 2 - 26, 0)));
  }

  // ---------------------------------------------------------------- build

  private clear() {
    for (const it of this.items) {
      this.stack.remove(it.mesh);
      it.mesh.geometry.dispose();
      for (const c of it.mesh.children) (c as THREE.LineSegments).geometry?.dispose();
      for (const m of it.mats) {
        (m as THREE.MeshBasicMaterial).map?.dispose();
        m.dispose();
      }
    }
    this.items = [];
    this.version++;
  }

  private build() {
    this.clear();
    if (this.w <= 0 || !this.fontsReady) return;
    const { l, r } = insets(!!this.opts.fit, !!this.opts.driven);
    const width = this.w - l - r;
    const dpr = Math.min(window.devicePixelRatio, 1.75);
    const font = getComputedStyle(this.canvas).fontFamily || "sans-serif";
    let top = this.opts.fit ? FIT_PAD : 0;
    let pendingArt = 0;

    this.entries.forEach((entry, i) => {
      if (entry.kind === "zone") {
        if (i > 0) top += HEAD_BEFORE;
        const mat = new THREE.MeshBasicMaterial({ map: headingTexture(entry.zone, entry.count, width, dpr, font), transparent: true });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, HEAD_H), mat);
        this.items.push({ entry, top, h: HEAD_H, mesh, mats: [mat], offX: 0, dim: 1, nameW: 0, lag: this.scroll, hidden: 1 });
        this.stack.add(mesh);
        top += HEAD_H + HEAD_AFTER;
        return;
      }
      const src = this.opts.artSrc(entry.p);
      const img = artCache.get(src);
      const art = img?.complete ? img : null;
      if (!art) {
        pendingArt++;
        loadArt(src).then(() => {
          if (--pendingArt === 0) this.build();
        });
      }
      const { tex, nameW } = spineTexture(entry.p, width, dpr, font, art);
      const front = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      const tint = mixWhite(CATEGORY_COLOR[entry.p.category].tint, 0.55);
      const shade = (k: number) => new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(k), transparent: true });
      const faces = [shade(0.9), shade(0.9), shade(0.97), shade(0.85), front, shade(0.9)];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, BOOK_H, BOOK_DEPTH), faces);
      const mats: THREE.Material[] = [...faces];
      mesh.userData.slug = entry.p.slug;
      const edgeMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(CATEGORY_COLOR[entry.p.category].solid).lerp(new THREE.Color(1, 1, 1), 0.6),
        transparent: true,
      });
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat));
      mats.push(edgeMat);
      this.items.push({ entry, top, h: BOOK_H, mesh, mats, offX: 0, dim: 1, nameW, lag: this.scroll, hidden: 1 });
      this.stack.add(mesh);
      top += BOOK_H + BOOK_GAP;
    });

    this.contentH = top;
    if (this.opts.fit) this.container.style.height = `${Math.ceil(top - BOOK_GAP + FIT_PAD)}px`;
    this.place();
    this.opts.onLength?.(this.maxScroll);
    if (this.pendingZone) this.scrollToZone(this.pendingZone.zone, this.pendingZone.instant);
  }

  private yOf(it: Item) {
    return this.h / 2 - (it.top + it.h / 2);
  }

  private place() {
    const { l, r } = insets(!!this.opts.fit, !!this.opts.driven);
    const cx = (l - r) / 2;
    for (const it of this.items) {
      it.mesh.position.set(cx + it.offX, this.yOf(it) + it.lag, it.entry.kind === "book" ? -BOOK_DEPTH / 2 : 0);
    }
  }

  private resize() {
    const rect = this.container.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w === this.w && h === this.h) return;
    const widthChanged = w !== this.w;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, Math.max(h, 1), false);
    if (this.opts.fit) {
      this.viewKey = NaN;
      this.updateFitCamera();
    } else {
      this.camera.aspect = w / Math.max(h, 1);
      this.camera.position.set(0, 0, h / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
      this.camera.updateProjectionMatrix();
    }
    if (widthChanged) this.build();
    else {
      this.place();
      this.opts.onLength?.(this.maxScroll);
    }
  }

  /** In fit mode the vanishing point follows the middle of the viewport, not the canvas. */
  private updateFitCamera() {
    const rect = this.canvas.getBoundingClientRect();
    const n = window.innerHeight / 2 - rect.top;
    if (Math.abs(n - this.viewKey) < 0.25) return false;
    this.viewKey = n;
    const full = Math.min(8000, 2 * Math.max(n, this.h - n, this.h / 2));
    const y = this.h / 2 - n;
    this.camera.aspect = this.w / full;
    this.camera.position.set(0, y, full / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    this.camera.setViewOffset(this.w, full, 0, full / 2 - n, this.w, this.h);
    this.camera.updateProjectionMatrix();
    return true;
  }

  private toScreen(v: THREE.Vector3) {
    const rect = this.canvas.getBoundingClientRect();
    v.project(this.camera);
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  // ---------------------------------------------------------------- input

  private pick(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const books = this.items.filter((i) => i.entry.kind === "book" && i.mesh.visible && i.hidden > 0.5);
    const hit = this.raycaster.intersectObjects(
      books.map((i) => i.mesh),
      false,
    )[0];
    return hit ? this.items.findIndex((i) => i.mesh === hit.object) : -1;
  }

  private onPointerMove = (e: PointerEvent) => {
    const d = this.dragging;
    if (d && e.pointerType !== "mouse" && !this.opts.fit && !this.opts.driven) {
      if (Math.abs(e.clientY - d.y) > 4) d.moved = true;
      this.target = Math.min(this.maxScroll, Math.max(0, d.scroll + (d.y - e.clientY)));
      this.user = true;
      return;
    }
    const i = this.pick(e);
    if (i !== this.hovered) {
      this.hovered = i;
      const it = this.items[i];
      this.opts.onHoverBook?.(it?.entry.kind === "book" ? it.entry.p : null);
      this.canvas.style.cursor = i >= 0 ? "pointer" : "";
    }
  };

  private onPointerLeave = () => {
    this.hovered = -1;
    this.canvas.style.cursor = "";
    this.opts.onHoverBook?.(null);
  };

  private onPointerDown = (e: PointerEvent) => {
    this.dragging = { x: e.clientX, y: e.clientY, scroll: this.target, moved: false };
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.dragging;
    this.dragging = null;
    if (!d || d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    if (e.target !== this.canvas) return;
    const it = this.items[this.pick(e)];
    if (it?.entry.kind === "book") this.opts.onOpen(it.entry.p);
  };

  private onPointerCancel = () => {
    this.dragging = null;
  };

  private onWheel = (e: WheelEvent) => {
    if (this.opts.fit || this.opts.driven || !this.running) return;
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    const target = e.target as Element | null;
    if (!desktop && !this.container.contains(target)) return;
    if (target?.closest?.("[data-wheel-ignore], [role=listbox], [role=dialog]")) return;
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    this.target = Math.min(this.maxScroll, Math.max(0, this.target + dy));
    this.user = true;
  };

  /** Keyboard / screen-reader focus on a book: bring it into view and highlight it. */
  focusBook(slug: string | null) {
    const i = slug ? this.items.findIndex((it) => it.entry.kind === "book" && it.entry.p.slug === slug) : -1;
    this.hovered = i;
    if (i < 0) return;
    const it = this.items[i];
    if (it.top - this.target < 40 || it.top + BOOK_H - this.target > this.h - 60) {
      this.target = Math.min(this.maxScroll, Math.max(0, it.top - this.h / 2 + BOOK_H / 2));
      if (this.opts.driven) this.opts.onScrollRequest?.(this.target, false);
    }
  }

  scrollBy(dy: number) {
    this.target = Math.min(this.maxScroll, Math.max(0, this.target + dy));
    this.user = true;
  }

  // ---------------------------------------------------------------- loop

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.running) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    const reduced = !!this.opts.reducedMotion;
    const k9 = 1 - Math.exp(-dt * 9);
    const k18 = 1 - Math.exp(-dt * 18);

    this.scroll = this.opts.driven || reduced ? this.target : this.scroll + (this.target - this.scroll) * k18;
    if (Math.abs(this.target - this.scroll) < 0.3) this.scroll = this.target;

    let viewChanged = false;
    if (this.opts.fit) {
      const y = window.scrollY;
      if (!Number.isNaN(this.pageY)) this.trail -= y - this.pageY;
      this.pageY = y;
      const rect = this.container.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
      viewChanged = this.updateFitCamera();
    }

    this.trail += (this.scroll - this.trail) * (1 - Math.exp(-dt * 13));
    this.trail = Math.max(this.scroll - 40, Math.min(this.scroll + 40, this.trail));
    if (this.opts.driven || reduced || Math.abs(this.scroll - this.trail) < 0.3) this.trail = this.scroll;

    if (this.revealAt === null && this.items.length) this.revealAt = this.opts.fit || reduced ? -Infinity : now;
    const hoveringBook = this.items[this.hovered]?.entry.kind === "book";
    const { l, r } = insets(!!this.opts.fit, !!this.opts.driven);
    const cx = (l - r) / 2;
    const camY = this.camera.position.y;
    let sig = 0;

    this.items.forEach((it, n) => {
      let shown = 1;
      if (this.revealAt !== null) {
        const depth = Math.min(1, Math.max(0, (it.top - this.scroll) / Math.max(this.h, 1)));
        const delay = rand(n) * REVEAL_JITTER + depth * REVEAL_SPREAD;
        shown = 1 - (1 - Math.min(1, Math.max(0, (now - this.revealAt - delay) / REVEAL_MS))) ** 4;
      }
      const flyX = (1 - shown) * REVEAL_X;
      it.mesh.rotation.y = (1 - shown) * -0.5;
      it.mesh.rotation.z = (1 - shown) * 0.06 * (rand(n + 7) - 0.5) * 2;

      const fromCenter = this.yOf(it) + this.scroll - camY;
      const s = Math.min(1, Math.abs(fromCenter) / (Math.max(this.h, window.innerHeight) / 2 + 1));
      it.lag = this.scroll + (this.trail - this.scroll) * (0.25 + 0.75 * s);
      it.mesh.position.y = this.yOf(it) + it.lag;

      let filtered = 1;
      if (it.entry.kind === "book") {
        it.mesh.visible = it.entry.p.slug !== this.hiddenSlug;
        if (this.filter && !this.filter.has(it.entry.p.category)) filtered = 0.14;
        const shift = n === this.hovered ? HOVER_SHIFT : 0;
        it.offX += (shift - it.offX) * k9 * 1.1;
      }
      it.hidden += (filtered - it.hidden) * k9;
      it.mesh.position.x = cx + it.offX + flyX;

      const dimTarget = hoveringBook && n !== this.hovered ? 0.55 : 1;
      it.dim += (dimTarget - it.dim) * k9;
      const opacity = it.dim * it.hidden * Math.min(1, shown * 1.6);
      for (const m of it.mats) m.opacity = opacity;
      sig += it.offX * 7 + it.dim * 13 + it.hidden * 5;
    });

    if (!this.opts.fit) this.opts.onProgress?.(this.scroll / Math.max(1, this.maxScroll));

    // which zone heading has scrolled past the upper third
    const line = this.scroll + this.h * 0.35;
    let zone: ZoneId | null = null;
    for (const it of this.items) {
      if (it.top > line) break;
      if (it.entry.kind === "zone") zone = it.entry.zone.id;
    }
    if (zone !== this.zoneInView) {
      this.zoneInView = zone;
      if (this.user && zone) this.opts.onUserZone?.(zone);
    }
    if (!this.opts.driven && Math.abs(this.target - this.scroll) < 0.05) this.user = false;

    const animating = this.revealAt !== null && now - this.revealAt < REVEAL_JITTER + REVEAL_SPREAD + REVEAL_MS + 60;
    const key = `${this.version}|${this.w}x${this.h}|${this.scroll.toFixed(2)}|${this.trail.toFixed(2)}|${this.hiddenSlug}|${sig.toFixed(3)}|${this.viewKey}`;
    if (!animating && !viewChanged && key === this.drawn) return;
    this.drawn = key;
    this.renderer.render(this.scene, this.camera);
  };
}
