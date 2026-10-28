import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BY_SLUG, CATEGORY_LABEL, PEPTIDES, ZONE_BY_ID } from "@/lib/catalog";
import { getArticle } from "@/lib/content";
import { ArticleView } from "@/components/detail/ArticleView";

export function generateStaticParams() {
  return PEPTIDES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/peptides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = BY_SLUG.get(slug);
  if (!p) return {};
  const description = p.summary || `${p.name}: ${p.cls}. ${CATEGORY_LABEL[p.category]}.`;
  return {
    title: p.name,
    description,
    alternates: { canonical: `/peptides/${p.slug}` },
    openGraph: { title: `${p.name} · ${ZONE_BY_ID[p.zone].name}`, description, type: "article" },
  };
}

export default async function PeptidePage({ params }: PageProps<"/peptides/[slug]">) {
  const { slug } = await params;
  const p = BY_SLUG.get(slug);
  if (!p) notFound();
  const article = getArticle(slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: p.name,
    description: article?.summary ?? p.summary,
    lastReviewed: article?.updated,
    about: {
      "@type": "Drug",
      name: p.name,
      alternateName: [...p.aliases, ...p.brands],
      drugClass: p.cls || undefined,
      mechanismOfAction: p.mechanism || undefined,
    },
    citation: article?.citations.map((c) => ({ "@type": "ScholarlyArticle", name: c.title, url: c.url })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ArticleView slug={slug} article={article} />
    </>
  );
}
