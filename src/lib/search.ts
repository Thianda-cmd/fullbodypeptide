import { PEPTIDES, ZONES, POPULAR, BY_SLUG, type Peptide, type Zone } from "./catalog";

export type Hit = { kind: "peptide"; p: Peptide; score: number } | { kind: "zone"; z: Zone; score: number };

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const words = (s: string) => s.split(" ").filter(Boolean);

function scorePeptide(p: Peptide, q: string): number | null {
  const name = norm(p.name);
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (words(name).some((w) => w.startsWith(q))) return 2;
  if (name.includes(q)) return 3;
  const alt = norm([...p.aliases, ...p.brands].join(" "));
  if (words(alt).some((w) => w.startsWith(q)) || alt.includes(` ${q}`)) return 4;
  if (alt.includes(q)) return 5;
  if (norm(p.cls).includes(q)) return 6;
  if (p.uses.some((u) => norm(u).includes(q))) return 7;
  if (norm(p.mechanism).includes(q)) return 8;
  return null;
}

export function search(query: string, limit = 8): Hit[] {
  const q = norm(query);
  if (!q) return [];
  const hits: Hit[] = [];
  for (const z of ZONES) {
    if (words(norm(`${z.name} ${z.short}`)).some((w) => w.startsWith(q))) hits.push({ kind: "zone", z, score: 4.5 });
  }
  for (const p of PEPTIDES) {
    const s = scorePeptide(p, q);
    if (s !== null) hits.push({ kind: "peptide", p, score: s });
  }
  return hits
    .sort(
      (a, b) =>
        a.score - b.score ||
        (a.kind === "peptide" && b.kind === "peptide"
          ? (a.p.popular ?? 999) - (b.p.popular ?? 999) || a.p.name.localeCompare(b.p.name)
          : 0),
    )
    .slice(0, limit);
}

export const popularHits = (n = 6): Hit[] => POPULAR.slice(0, n).map((p) => ({ kind: "peptide", p, score: 0 }));

// ---------------------------------------------------------------- recent searches

const KEY = "fbp-recent";
export function getRecent(): Peptide[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[])
      .map((s) => BY_SLUG.get(s))
      .filter((p): p is Peptide => Boolean(p));
  } catch {
    return [];
  }
}
export function pushRecent(p: Peptide) {
  try {
    const rest = getRecent()
      .map((x) => x.slug)
      .filter((s) => s !== p.slug);
    localStorage.setItem(KEY, JSON.stringify([p.slug, ...rest].slice(0, 6)));
  } catch {}
}
export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
