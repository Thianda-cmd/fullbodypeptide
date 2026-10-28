// Sequence glyphs: every peptide gets a small ball-and-stick drawing of a chain
// of residues, generated from its slug, so each entry has artwork of its own.
// The drawing is decorative and does not encode the real sequence.

export type BeadKind = 0 | 1 | 2; // open ring, ink, category colour

export interface Bead {
  x: number;
  y: number;
  r: number;
  z: number; // depth, -1 (back) to 1 (front); 0 for flat chains
  kind: BeadKind;
}

export interface Stub {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  r: number;
}

export interface Glyph {
  beads: Bead[];
  bonds: [number, number][];
  stubs: Stub[];
  stroke: number;
}

type Pt = { a: number; b: number; z: number };

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** n points spaced evenly by arc length along a curve over u in [0, 1]. */
function resample(curve: (u: number) => Pt, n: number) {
  const N = 240;
  const pts = Array.from({ length: N + 1 }, (_, i) => curve(i / N));
  const acc = [0];
  for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].a - pts[i - 1].a, pts[i].b - pts[i - 1].b));
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const target = (acc[N] * k) / (n - 1);
    while (j < N && acc[j] < target) j++;
    const t = (target - acc[j - 1]) / (acc[j] - acc[j - 1] || 1);
    const p = pts[j - 1];
    const q = pts[j];
    out.push({ a: p.a + (q.a - p.a) * t, b: p.b + (q.b - p.b) * t, z: p.z + (q.z - p.z) * t });
  }
  return { pts: out, step: acc[N] / (n - 1) };
}

/** The glyph for `seed`, laid out to fill a w×h box (any unit). */
export function glyph(seed: string, w: number, h: number): Glyph {
  const rnd = rng(hash(seed));
  // the chain itself is the same in every box; only its layout adapts
  const roll = rnd();
  const n = 10 + Math.floor(rnd() * 9);
  const kinds = Array.from({ length: n }, (): BeadKind => {
    const k = rnd();
    return k < 0.22 ? 2 : k < 0.5 ? 1 : 0;
  });
  if (!kinds.includes(2)) kinds[n >> 1] = 2;
  const sizes = Array.from({ length: n }, () => 0.8 + rnd() * 0.4);
  const sides = Array.from({ length: n }, () => rnd() < 0.3);
  const phase = rnd() * Math.PI * 2;
  const turns = 1.4 + rnd() * 1.4;
  const amp = 0.6 + rnd() * 0.3;
  const lobes = rnd() < 0.5 ? 1 : 1.5;
  const tailFrac = 0.25 + rnd() * 0.2;

  const vertical = h > w;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const asp = long / short;
  const strip = asp >= 1.8;
  const shape = roll < 0.4 ? "helix" : roll < 0.72 ? "fold" : "ring";

  // build in a frame where a runs along the long side and b across it, b in [-1, 1]
  let pts: Pt[];
  let base: number;
  const bonds: [number, number][] = [];
  if (shape === "ring") {
    const tail = Math.max(2, Math.round(n * tailFrac));
    const m = n - tail;
    const R = strip ? 0.82 : 0.5;
    const chord = 2 * R * Math.sin(Math.PI / m);
    const dir = strip ? 0 : -0.55; // the tail leaves the ring along this angle
    pts = [];
    for (let k = 0; k < m; k++) {
      const t = dir + (2 * Math.PI * k) / m;
      pts.push({ a: R * Math.cos(t), b: R * Math.sin(t), z: 0 });
      if (k) bonds.push([k - 1, k]);
    }
    bonds.push([m - 1, 0]);
    let prev = 0;
    for (let t = 1; t <= tail; t++) {
      const along = R + chord * t;
      const wob = Math.sin(t * 1.3 + phase) * chord * 0.3;
      pts.push({ a: Math.cos(dir) * along - Math.sin(dir) * wob, b: Math.sin(dir) * along + Math.cos(dir) * wob, z: 0 });
      bonds.push([prev, pts.length - 1]);
      prev = pts.length - 1;
    }
    base = chord * 0.36;
  } else {
    // plates lay the chain along their diagonal, as if it were a long strip
    const span = (strip ? asp : 2.4) * 0.92;
    const curve =
      shape === "helix"
        ? (u: number) => {
            const t = 2 * Math.PI * turns * u + phase;
            return { a: (-1 + 2 * u) * span, b: amp * Math.sin(t), z: Math.cos(t) };
          }
        : (u: number) => {
            const t = 2 * Math.PI * turns * 0.5 * u + phase;
            return { a: (-1 + 2 * u) * span, b: amp * (0.65 * Math.sin(t) + 0.35 * Math.sin(2.3 * t + phase)), z: 0 };
          };
    const r = resample(curve, n);
    const tilt = strip ? 0 : -0.62 + lobes * 0.08;
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    pts = r.pts.map((p) => ({ a: p.a * c - p.b * s, b: p.a * s + p.b * c, z: p.z }));
    for (let k = 1; k < n; k++) bonds.push([k - 1, k]);
    base = Math.min(r.step * (strip ? 0.38 : 0.32), strip ? 0.3 : 0.24);
  }

  const beads = pts.map((p, i) => ({ ...p, r: base * sizes[i] * (p.z ? 0.82 + 0.18 * p.z : 1), kind: kinds[i] }));

  // side chains stick out sideways from some residues
  const stubs: { a1: number; b1: number; a2: number; b2: number; r: number }[] = [];
  beads.forEach((bd, i) => {
    if (!sides[i] || bd.z < -0.3) return;
    const p = beads[Math.max(0, i - 1)];
    const q = beads[Math.min(n - 1, i + 1)];
    let ta = q.a - p.a;
    let tb = q.b - p.b;
    const len = Math.hypot(ta, tb) || 1;
    ta /= len;
    tb /= len;
    const s = i % 2 ? 1 : -1;
    const L = bd.r * 2.1;
    stubs.push({ a1: bd.a, b1: bd.b, a2: bd.a - tb * L * s, b2: bd.b + ta * L * s, r: bd.r * 0.42 });
  });

  // fit everything into the box, centred, with a margin
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;
  const grow = (a: number, b: number, r: number) => {
    minA = Math.min(minA, a - r);
    maxA = Math.max(maxA, a + r);
    minB = Math.min(minB, b - r);
    maxB = Math.max(maxB, b + r);
  };
  for (const b of beads) grow(b.a, b.b, b.r);
  for (const s of stubs) grow(s.a2, s.b2, s.r);
  const pad = short * (strip ? 0.16 : 0.14);
  const scale = Math.min((long - 2 * pad) / (maxA - minA), (short - 2 * pad) / (maxB - minB));
  const ca = (minA + maxA) / 2;
  const cb = (minB + maxB) / 2;
  const toXY = (a: number, b: number) => {
    const u = (a - ca) * scale;
    const v = (b - cb) * scale;
    return vertical ? { x: w / 2 + v, y: h / 2 + u } : { x: w / 2 + u, y: h / 2 + v };
  };

  return {
    beads: beads.map((b) => ({ ...toXY(b.a, b.b), r: b.r * scale, z: b.z, kind: b.kind })),
    bonds,
    stubs: stubs.map((s) => {
      const p1 = toXY(s.a1, s.b1);
      const p2 = toXY(s.a2, s.b2);
      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, r: s.r * scale };
    }),
    stroke: Math.min(Math.max(0.9, base * scale * 0.16), 2.4),
  };
}

/** Beads in drawing order, back to front. */
export const drawOrder = (g: Glyph) => g.beads.map((b, i) => ({ b, i })).sort((p, q) => p.b.z - q.b.z);

export interface GlyphColors {
  ink: string;
  mark: string;
  fill: string;
}

export function drawGlyph(ctx: CanvasRenderingContext2D, g: Glyph, c: GlyphColors) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = g.stroke;
  ctx.strokeStyle = c.ink;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (const [i, j] of g.bonds) {
    ctx.moveTo(g.beads[i].x, g.beads[i].y);
    ctx.lineTo(g.beads[j].x, g.beads[j].y);
  }
  for (const s of g.stubs) {
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = c.ink;
  for (const s of g.stubs) {
    ctx.beginPath();
    ctx.arc(s.x2, s.y2, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const { b } of drawOrder(g)) {
    ctx.globalAlpha = b.z < -0.2 ? 0.55 : 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.kind === 0 ? c.fill : b.kind === 1 ? c.ink : c.mark;
    ctx.fill();
    if (b.kind === 0) ctx.stroke();
  }
  ctx.restore();
}
