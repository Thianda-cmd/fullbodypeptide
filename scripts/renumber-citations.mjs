#!/usr/bin/env node
// Renumbers an entry's citations in order of first appearance and rewrites
// every [^n] marker to match. Usage: node scripts/renumber-citations.mjs <slug>...

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

// Same field order the page renders in, so "first appearance" matches reading order.
function richFields(a) {
  const out = [];
  out.push(a.takeaway);
  for (const [, v] of a.glance ?? []) out.push(v);
  for (const s of a.sections ?? [])
    for (const b of s.blocks ?? []) {
      if (b.text) out.push(b.text);
      for (const it of b.items ?? []) out.push(it);
      for (const r of b.rows ?? []) out.push(...r);
    }
  if (a.evidence?.text) out.push(a.evidence.text);
  for (const f of a.faq ?? []) out.push(f.a);
  return out.filter((x) => typeof x === "string");
}

function remapText(text, map) {
  return typeof text === "string" ? text.replace(/\[\^(\d+)\]/g, (_, n) => `[^${map.get(Number(n)) ?? n}]`) : text;
}

for (const slug of process.argv.slice(2)) {
  const file = join(root, "content/peptides", `${slug}.json`);
  const d = JSON.parse(readFileSync(file, "utf8"));
  const a = d.article;
  const order = [];
  for (const t of richFields(a)) for (const m of t.matchAll(/\[\^(\d+)\]/g)) if (!order.includes(Number(m[1]))) order.push(Number(m[1]));
  for (const c of a.citations) if (!order.includes(c.n)) order.push(c.n);
  const map = new Map(order.map((oldN, i) => [oldN, i + 1]));

  a.takeaway = remapText(a.takeaway, map);
  a.glance = a.glance.map(([k, v]) => [k, remapText(v, map)]);
  for (const s of a.sections)
    for (const b of s.blocks) {
      if (b.text) b.text = remapText(b.text, map);
      if (b.items) b.items = b.items.map((x) => remapText(x, map));
      if (b.rows) b.rows = b.rows.map((r) => r.map((x) => remapText(x, map)));
    }
  if (a.evidence?.text) a.evidence.text = remapText(a.evidence.text, map);
  a.faq = a.faq.map((f) => ({ ...f, a: remapText(f.a, map) }));
  a.citations = a.citations.map((c) => ({ ...c, n: map.get(c.n) })).sort((x, y) => x.n - y.n);

  writeFileSync(file, JSON.stringify(d, null, 2) + "\n");
  console.log(`${slug}: ${[...map].filter(([o, n]) => o !== n).map(([o, n]) => `${o}→${n}`).join(", ") || "already in order"}`);
}
