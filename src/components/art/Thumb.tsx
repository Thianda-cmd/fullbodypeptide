import { CATEGORY_COLOR, artSrc, type Peptide } from "@/lib/catalog";

/** Small art tile with the category stripe, used in lists and search. */
export function Thumb({ p, className = "size-9" }: { p: Peptide; className?: string }) {
  const c = CATEGORY_COLOR[p.category];
  return (
    <span aria-hidden="true" className={`relative flex shrink-0 flex-col overflow-hidden rounded-[4px] bg-white ${className}`}>
      <span className="relative min-h-0 flex-1" style={{ backgroundColor: c.tint }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artSrc(p, "thumb")}
          alt=""
          loading="lazy"
          draggable={false}
          className="absolute inset-0 size-full object-cover mix-blend-soft-light"
        />
      </span>
      <span className="h-[3px] shrink-0" style={{ background: c.line }} />
    </span>
  );
}
