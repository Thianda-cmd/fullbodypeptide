import type { MetadataRoute } from "next";
import { PEPTIDES, ZONES } from "@/lib/catalog";

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    ...ZONES.map((z) => ({ url: `${site}/?z=${z.id}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...PEPTIDES.map((p) => ({ url: `${site}/peptides/${p.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
