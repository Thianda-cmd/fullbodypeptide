"use client";

import { CATEGORIES, CATEGORY_LABEL, PEPTIDES, type Category } from "@/lib/catalog";
import { Dot } from "@/components/ui/Dot";

const COUNTS = Object.fromEntries(CATEGORIES.map((c) => [c, PEPTIDES.filter((p) => p.category === c).length])) as Record<Category, number>;

/** Status legend that doubles as a filter for the shelf. */
export function Legend({ filter, onChange, className = "" }: { filter: Category[]; onChange: (f: Category[]) => void; className?: string }) {
  const toggle = (c: Category) => {
    const next = filter.includes(c) ? filter.filter((x) => x !== c) : [...filter, c];
    onChange(next.length === CATEGORIES.length ? [] : next);
  };
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <ul className="flex max-w-[23rem] flex-wrap gap-x-3.5 gap-y-1" aria-label="Filter by status">
        {CATEGORIES.map((c) => {
          const on = filter.length === 0 || filter.includes(c);
          return (
            <li key={c}>
              <button
                type="button"
                aria-pressed={filter.includes(c)}
                onClick={() => toggle(c)}
                className={`type-body-xs group inline-flex items-center gap-1.5 rounded-full py-0.5 pr-1 whitespace-nowrap transition-opacity duration-300 ${
                  on ? "text-ink/60 hover:text-ink" : "text-ink/30 hover:text-ink/60"
                }`}
              >
                <Dot c={c} className={`transition-transform duration-300 ${filter.includes(c) ? "scale-125" : ""}`} />
                {CATEGORY_LABEL[c]}
                <span className="text-ink/35 tabular-nums">{COUNTS[c]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="type-body-xs h-4 text-ink/40">
        {filter.length > 0 ? (
          <button type="button" onClick={() => onChange([])} className="underline decoration-ink/20 underline-offset-2 hover:text-ink">
            Show every status
          </button>
        ) : (
          "Tap a status to filter the shelf"
        )}
      </p>
    </div>
  );
}
