#!/usr/bin/env node
// Validates content/peptides/<slug>.json against content/AUTHORING.md.
//   node scripts/validate-content.mjs            # every entry in content/index.json
//   node scripts/validate-content.mjs a-slug b   # only these
// Exits 1 when any entry has errors; warnings never fail.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const index = JSON.parse(readFileSync(join(root, "content/index.json"), "utf8"));
const bySlug = new Map(index.map((e) => [e.slug, e]));
const CATEGORIES = new Set(["fda", "clinical", "wellness", "cosmetic"]);
const ZONES = new Set(JSON.parse(readFileSync(join(root, "content/zones.json"), "utf8")).map((z) => z.id));
const BLOCKS = new Set(["p", "ul", "ol", "h3", "note", "table"]);

const args = process.argv.slice(2);
const slugs = args.length ? args : index.map((e) => e.slug);
let failed = 0;
let missing = 0;

function richIssues(text, where, ctx) {
  if (typeof text !== "string" || !text.trim()) {
    ctx.err(`${where}: expected non-empty string`);
    return;
  }
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    const href = m[2];
    if (href.startsWith("/peptides/")) {
      const target = href.slice("/peptides/".length);
      if (!bySlug.has(target)) ctx.err(`${where}: link to unknown peptide "${target}"`);
      if (target === ctx.slug) ctx.warn(`${where}: links to itself`);
    } else if (!/^https:\/\//.test(href)) {
      ctx.err(`${where}: link "${href}" must be /peptides/<slug> or https://`);
    }
  }
  for (const m of text.matchAll(/\[\^(\d+)\]/g)) ctx.markers.push({ n: Number(m[1]), where });
  if (/\[\^[^\d\]]/.test(text)) ctx.err(`${where}: malformed citation marker`);
  if (/[—]/.test(text)) ctx.warn(`${where}: contains an em dash`);
  if (/[“”]/.test(text)) ctx.warn(`${where}: contains curly double quotes`);
  ctx.words += text.split(/\s+/).filter(Boolean).length;
}

function str(v, max, where, ctx, { min = 1 } = {}) {
  if (typeof v !== "string" || v.trim().length < min) return ctx.err(`${where}: expected string (min ${min} chars)`);
  if (max && v.length > max) ctx.err(`${where}: ${v.length} chars, max ${max}`);
}

function validate(slug) {
  const errors = [];
  const warnings = [];
  const ctx = {
    slug,
    markers: [],
    words: 0,
    err: (m) => errors.push(m),
    warn: (m) => warnings.push(m),
  };
  const file = join(root, "content/peptides", `${slug}.json`);
  const entry = bySlug.get(slug);
  if (!entry) return { errors: [`"${slug}" is not in content/index.json`], warnings };
  if (!existsSync(file)) return { missing: true, errors: [], warnings };

  let d;
  try {
    d = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { errors: [`invalid JSON: ${e.message}`], warnings };
  }

  if (d.slug !== slug) ctx.err(`slug "${d.slug}" does not match file name`);
  if (d.name !== entry.name) ctx.err(`name "${d.name}" must be "${entry.name}" (from index.json)`);
  if (d.zone !== entry.zone || !ZONES.has(d.zone)) ctx.err(`zone must be "${entry.zone}"`);
  if (d.category !== entry.category || !CATEGORIES.has(d.category)) ctx.err(`category must be "${entry.category}"`);
  if ((d.popular ?? null) !== entry.popular) ctx.err(`popular must be ${entry.popular}`);
  for (const k of ["aliases", "brands"]) {
    if (!Array.isArray(d[k]) || d[k].some((x) => typeof x !== "string" || !x.trim())) ctx.err(`${k}: expected array of strings`);
  }
  str(d.class, 56, "class", ctx);
  str(d.route, 90, "route", ctx);
  str(d.status, 150, "status", ctx);
  str(d.mechanism, 170, "mechanism", ctx);
  if (typeof d.mechanism === "string" && d.mechanism.trim().endsWith(".")) ctx.err("mechanism: drop the final period");
  if (![1, 2, 3, 4].includes(d.evidence)) ctx.err("evidence: must be 1-4");
  if (d.category === "fda" && d.evidence !== 4) ctx.err("evidence: fda entries must be 4");
  if (d.category !== "fda" && d.evidence === 4) ctx.err("evidence: only fda entries can be 4");
  if (!Array.isArray(d.uses) || d.uses.length < 1 || d.uses.length > 5 || d.uses.some((u) => typeof u !== "string" || u.length > 60))
    ctx.err("uses: 1-5 short strings (max 60 chars)");
  if (!Array.isArray(d.related) || d.related.length < 2 || d.related.length > 5) ctx.err("related: 2-5 slugs");
  else
    for (const r of d.related) {
      if (!bySlug.has(r)) ctx.err(`related: unknown slug "${r}"`);
      if (r === slug) ctx.err("related: must not include itself");
    }
  if (new Set(d.related ?? []).size !== (d.related ?? []).length) ctx.err("related: duplicates");

  const a = d.article;
  if (!a || typeof a !== "object") {
    ctx.err("article: missing");
    return { errors, warnings };
  }
  str(a.summary, 230, "article.summary", ctx, { min: 90 });
  if (typeof a.summary === "string" && /[\[\]*]/.test(a.summary)) ctx.err("article.summary: plain text only");
  ctx.words += (a.summary ?? "").split(/\s+/).length;
  richIssues(a.takeaway, "article.takeaway", ctx);

  if (!Array.isArray(a.glance) || a.glance.length < 4 || a.glance.length > 7) ctx.err("article.glance: 4-7 rows");
  else
    a.glance.forEach((row, i) => {
      if (!Array.isArray(row) || row.length !== 2) return ctx.err(`article.glance[${i}]: expected [label, value]`);
      str(row[0], 32, `article.glance[${i}][0]`, ctx);
      richIssues(row[1], `article.glance[${i}][1]`, ctx);
    });

  if (!Array.isArray(a.sections) || a.sections.length < 4 || a.sections.length > 7) ctx.err("article.sections: 4-7 sections");
  const ids = new Set();
  (a.sections ?? []).forEach((s, i) => {
    const w = `sections[${i}]`;
    if (typeof s.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) ctx.err(`${w}.id: kebab-case required`);
    if (ids.has(s.id)) ctx.err(`${w}.id: duplicate "${s.id}"`);
    ids.add(s.id);
    str(s.title, 60, `${w}.title`, ctx);
    if (!Array.isArray(s.blocks) || s.blocks.length === 0) return ctx.err(`${w}.blocks: at least one block`);
    s.blocks.forEach((b, j) => {
      const bw = `${w}.blocks[${j}]`;
      if (!BLOCKS.has(b?.type)) return ctx.err(`${bw}: unknown type "${b?.type}"`);
      if (b.type === "ul" || b.type === "ol") {
        if (!Array.isArray(b.items) || b.items.length < 2 || b.items.length > 8) ctx.err(`${bw}: 2-8 items`);
        (b.items ?? []).forEach((it, k) => richIssues(it, `${bw}.items[${k}]`, ctx));
      } else if (b.type === "table") {
        if (!Array.isArray(b.rows) || b.rows.length < 2 || b.rows.length > 8) ctx.err(`${bw}: 2-8 rows`);
        const width = b.rows?.[0]?.length;
        (b.rows ?? []).forEach((r, k) => {
          if (!Array.isArray(r) || r.length !== width || width < 2 || width > 4) ctx.err(`${bw}.rows[${k}]: consistent 2-4 cells`);
          (r ?? []).forEach((c, m) => richIssues(c, `${bw}.rows[${k}][${m}]`, ctx));
        });
      } else richIssues(b.text, `${bw}.text`, ctx);
    });
  });

  if (!a.evidence || typeof a.evidence !== "object") ctx.err("article.evidence: missing");
  else {
    str(a.evidence.label, 60, "article.evidence.label", ctx);
    richIssues(a.evidence.text, "article.evidence.text", ctx);
  }

  if (!Array.isArray(a.faq) || a.faq.length < 3 || a.faq.length > 6) ctx.err("article.faq: 3-6 questions");
  (a.faq ?? []).forEach((f, i) => {
    str(f.q, 140, `faq[${i}].q`, ctx);
    if (typeof f.q === "string" && !f.q.trim().endsWith("?")) ctx.warn(`faq[${i}].q: should end with "?"`);
    richIssues(f.a, `faq[${i}].a`, ctx);
  });

  const cites = a.citations;
  if (!Array.isArray(cites) || cites.length < 3 || cites.length > 10) ctx.err("article.citations: 3-10 entries");
  const urls = new Set();
  (cites ?? []).forEach((c, i) => {
    const w = `citations[${i}]`;
    if (c.n !== i + 1) ctx.err(`${w}.n: expected ${i + 1}`);
    str(c.title, 300, `${w}.title`, ctx);
    str(c.source, 80, `${w}.source`, ctx);
    if (!Number.isInteger(c.year) || c.year < 1950 || c.year > 2026) ctx.err(`${w}.year: 1950-2026`);
    if (typeof c.url !== "string" || !/^https:\/\/\S+$/.test(c.url)) ctx.err(`${w}.url: https URL required`);
    if (urls.has(c.url)) ctx.err(`${w}.url: duplicate`);
    urls.add(c.url);
    if (c.pmid != null && !/^\d{5,9}$/.test(String(c.pmid))) ctx.err(`${w}.pmid: digits only`);
    if (c.pmid != null && c.url !== `https://pubmed.ncbi.nlm.nih.gov/${c.pmid}/`) ctx.err(`${w}.url: must be the PubMed URL for its pmid`);
    if (c.doi != null && !/^10\.\d{4,9}\/\S+$/.test(c.doi)) ctx.err(`${w}.doi: malformed`);
    if (c.note != null) str(c.note, 100, `${w}.note`, ctx);
  });
  const n = cites?.length ?? 0;
  const referenced = new Set();
  for (const m of ctx.markers) {
    if (m.n < 1 || m.n > n) ctx.err(`${m.where}: [^${m.n}] has no citation`);
    referenced.add(m.n);
  }
  for (let i = 1; i <= n; i++) if (!referenced.has(i)) ctx.err(`citation ${i} is never referenced`);
  const firsts = [];
  for (const m of ctx.markers) if (!firsts.includes(m.n)) firsts.push(m.n);
  if (firsts.some((v, i) => i > 0 && v < firsts[i - 1])) ctx.warn("citations are not numbered in order of first appearance");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.updated ?? "")) ctx.err("article.updated: YYYY-MM-DD");
  if (ctx.words < 380) ctx.warn(`only ~${ctx.words} words`);
  if (ctx.words > 1500) ctx.warn(`~${ctx.words} words, consider trimming`);
  return { errors, warnings, words: ctx.words };
}

let totalWords = 0;
let done = 0;
for (const slug of slugs) {
  const { errors, warnings, missing: isMissing, words = 0 } = validate(slug);
  if (isMissing) {
    missing++;
    if (args.length) console.log(`✗ ${slug}: file missing`);
    if (args.length) failed++;
    continue;
  }
  done++;
  totalWords += words;
  if (errors.length) failed++;
  if (errors.length || warnings.length) {
    console.log(`${errors.length ? "✗" : "!"} ${slug} (${words} words)`);
    for (const e of errors) console.log(`   error: ${e}`);
    for (const w of warnings) console.log(`   warn:  ${w}`);
  }
}
console.log(
  `\n${done} checked, ${failed} with errors, ${missing} missing of ${slugs.length}` +
    (done ? `, ~${Math.round(totalWords / done)} words avg` : ""),
);
process.exit(failed ? 1 : 0);
