import { CATEGORY_COLOR, type Category } from "@/lib/catalog";

export function Dot({ c, size = 6, className = "" }: { c: Category; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size, background: CATEGORY_COLOR[c].solid }}
    />
  );
}

export function Count({ n, className = "" }: { n: number; className?: string }) {
  return <span className={`ml-[0.3em] text-ink/40 tabular-nums ${className}`}>({n})</span>;
}
