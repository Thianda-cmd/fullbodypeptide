import catalog from "@/data/catalog.json";

export type Category = "fda" | "clinical" | "wellness" | "cosmetic";
export type ZoneId = "brain" | "skin" | "digestive" | "immune" | "hormones" | "bones" | "heart" | "sex";

export interface Zone {
  id: ZoneId;
  short: string;
  name: string;
  blurb: string;
}

export interface Peptide {
  slug: string;
  name: string;
  zone: ZoneId;
  category: Category;
  popular: number | null;
  cls: string;
  aliases: string[];
  brands: string[];
  route: string;
  status: string;
  evidence: number;
  mechanism: string;
  uses: string[];
  related: string[];
  summary: string;
  art: number;
  ready: boolean;
}

export const ZONES = catalog.zones as Zone[];
export const PEPTIDES = catalog.peptides as Peptide[];
export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z])) as Record<ZoneId, Zone>;
export const BY_SLUG = new Map(PEPTIDES.map((p) => [p.slug, p]));

export const CATEGORIES: Category[] = ["fda", "clinical", "wellness", "cosmetic"];

export const CATEGORY_LABEL: Record<Category, string> = {
  fda: "FDA-approved",
  clinical: "In clinical trials",
  wellness: "Not FDA-approved",
  cosmetic: "Cosmetic and topical",
};

/** Strong dot/stripe colour and the pale tint behind card art, per category. */
export const CATEGORY_COLOR: Record<Category, { solid: string; tint: string; line: string }> = {
  fda: { solid: "#3dba80", tint: "#c3f0d8", line: "#3dba80" },
  clinical: { solid: "#d6c437", tint: "#efe9a6", line: "#d6c437" },
  wellness: { solid: "#e173d2", tint: "#f6d0ef", line: "#e173d2" },
  cosmetic: { solid: "#a2a4ad", tint: "#e4e5e9", line: "#d4d5da" },
};

export const EVIDENCE_LABEL: Record<number, string> = {
  0: "Not yet rated",
  1: "Low research",
  2: "Moderate research",
  3: "Deep research",
  4: "FDA approved",
};

const CATEGORY_RANK: Record<Category, number> = { fda: 0, clinical: 1, wellness: 2, cosmetic: 3 };

export function compareShelf(a: Peptide, b: Peptide) {
  const c = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
  if (c) return c;
  const pa = a.popular ?? 999;
  const pb = b.popular ?? 999;
  return pa === pb ? a.name.localeCompare(b.name) : pa - pb;
}

const byZone = new Map<ZoneId, Peptide[]>(ZONES.map((z) => [z.id, PEPTIDES.filter((p) => p.zone === z.id).sort(compareShelf)]));

export function peptidesInZone(zone: ZoneId): Peptide[] {
  return byZone.get(zone) ?? [];
}

export const ZONE_COUNT = Object.fromEntries(ZONES.map((z) => [z.id, peptidesInZone(z.id).length])) as Record<ZoneId, number>;

/** The most-searched entries, used for "Popular" lists. */
export const POPULAR = PEPTIDES.filter((p) => p.popular !== null)
  .sort((a, b) => (a.popular ?? 0) - (b.popular ?? 0))
  .slice(0, 8);

export function topInZone(zone: ZoneId, n: number) {
  return [...peptidesInZone(zone)].sort((a, b) => (a.popular ?? 999) - (b.popular ?? 999) || compareShelf(a, b)).slice(0, n);
}

/** "Tesamorelin (off-label)" -> { base: "Tesamorelin", qualifier: "off-label" } */
export function splitName(name: string) {
  const m = name.match(/^(.*?)\s*\(([^)]+)\)$/);
  return m ? { base: m[1], qualifier: m[2] } : { base: name, qualifier: null };
}

export const peptideHref = (slug: string) => `/peptides/${slug}`;
export const zoneHref = (zone: ZoneId) => `/?z=${zone}`;

export function isZoneId(v: unknown): v is ZoneId {
  return typeof v === "string" && v in ZONE_BY_ID;
}

export const ART_POOL = 48;
export const artSrc = (p: Pick<Peptide, "art">, size: "tall" | "thumb" = "tall") =>
  `/art/${size}/${String(p.art).padStart(2, "0")}.webp`;
