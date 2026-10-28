import { CATEGORY_COLOR, type Peptide } from "@/lib/catalog";
import { drawOrder, glyph } from "@/lib/glyph";

const INK = "#16171d";
const f = (n: number) => Math.round(n * 10) / 10;

/** The peptide's sequence glyph as SVG, centred in a w×h viewBox. */
export function GlyphArt({
  p,
  w = 100,
  h = 100,
  crop = false,
  className,
}: {
  p: Pick<Peptide, "slug" | "category">;
  w?: number;
  h?: number;
  /** fill the element and crop the overflow instead of fitting the whole chain */
  crop?: boolean;
  className?: string;
}) {
  const g = glyph(p.slug, w, h);
  const c = CATEGORY_COLOR[p.category];
  const d =
    g.bonds.map(([i, j]) => `M${f(g.beads[i].x)} ${f(g.beads[i].y)}L${f(g.beads[j].x)} ${f(g.beads[j].y)}`).join("") +
    g.stubs.map((s) => `M${f(s.x1)} ${f(s.y1)}L${f(s.x2)} ${f(s.y2)}`).join("");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio={crop ? "xMidYMid slice" : undefined} className={className} aria-hidden="true">
      <path d={d} fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={f(g.stroke)} strokeLinecap="round" />
      {g.stubs.map((s, i) => (
        <circle key={`s${i}`} cx={f(s.x2)} cy={f(s.y2)} r={f(s.r)} fill={INK} />
      ))}
      {drawOrder(g).map(({ b, i }) => (
        <circle
          key={i}
          cx={f(b.x)}
          cy={f(b.y)}
          r={f(b.r)}
          fill={b.kind === 0 ? c.tint : b.kind === 1 ? INK : c.solid}
          stroke={b.kind === 0 ? INK : undefined}
          strokeWidth={b.kind === 0 ? f(g.stroke) : undefined}
          opacity={b.z < -0.2 ? 0.55 : undefined}
        />
      ))}
    </svg>
  );
}
