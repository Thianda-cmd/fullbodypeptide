import { CATEGORY_COLOR, type Peptide } from "@/lib/catalog";
import { GlyphArt } from "./Glyph";

/** Small glyph tile on the category tint, used in lists and search. */
export function Thumb({ p, className = "size-9" }: { p: Peptide; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 overflow-hidden rounded-[3px] shadow-[inset_0_0_0_1px_rgb(48_40_24/0.1)] ${className}`}
      style={{ backgroundColor: CATEGORY_COLOR[p.category].tint }}
    >
      {/* a close crop of the strip layout keeps the beads legible at icon size */}
      <GlyphArt p={p} w={190} h={100} crop className="size-full" />
    </span>
  );
}
