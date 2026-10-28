#!/usr/bin/env node
// Compiles content/ into src/data/catalog.json: the compact index the client
// needs for the shelf, search and navigation. Full articles stay in
// content/peptides and are read per page on the server.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const index = JSON.parse(readFileSync(join(root, "content/index.json"), "utf8"));
const zones = JSON.parse(readFileSync(join(root, "content/zones.json"), "utf8"));

// Art is assigned from a fixed pool so neighbours on a shelf rarely repeat.
const ART_POOL = 48;

let missing = 0;
const peptides = index.map((entry, i) => {
  const file = join(root, "content/peptides", `${entry.slug}.json`);
  const d = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  if (!d) missing++;
  return {
    slug: entry.slug,
    name: entry.name,
    zone: entry.zone,
    category: entry.category,
    popular: entry.popular,
    cls: d?.class ?? "",
    aliases: d?.aliases ?? [],
    brands: d?.brands ?? [],
    route: d?.route ?? "",
    status: d?.status ?? "",
    evidence: d?.evidence ?? 0,
    mechanism: d?.mechanism ?? "",
    uses: d?.uses ?? [],
    related: d?.related ?? [],
    summary: d?.article?.summary ?? "",
    art: (i * 17) % ART_POOL,
    ready: Boolean(d),
  };
});

writeFileSync(join(root, "src/data/catalog.json"), JSON.stringify({ zones, peptides }) + "\n");
console.log(`catalog: ${peptides.length} peptides, ${zones.length} zones${missing ? `, ${missing} without content yet` : ""}`);
