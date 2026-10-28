# Full Body · Peptide Library

An interactive 3D map of 152 peptides — FDA-approved drugs, clinical-trial candidates,
gray-market compounds and skincare actives — placed on the part of the body they act on.

- **3D body** (female and male) with eight body zones. Hover or pick a zone to fly the camera
  there; each zone has its own animated highlight (neural pulses, heartbeat and circulation,
  lymph nodes, thyroid, joints, skin aura…). Drag to rotate.
- **3D shelf** of every peptide as a book in perspective, with an elastic scroll, staggered
  reveal and a flight animation that turns a spine into the detail card.
- **Detail pages** with a guide (takeaway, at a glance, mechanism, research, safety, regulatory
  status, FAQ) and verified citations, statically generated for every peptide.
- Search (`/` or `⌘K`), hover mega-menus, status filters, keyboard and screen-reader support,
  reduced-motion support and a mobile layout where the page scroll drives the shelf.

Built with Next.js 16 (App Router, Cache Components), React 19, three.js, Motion and Tailwind CSS 4.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (also regenerates src/data/catalog.json)
```

## Content

Each peptide is one JSON file in `content/peptides/<slug>.json`; the master list of slugs,
zones and statuses is `content/index.json`. The format and writing rules are in
[`content/AUTHORING.md`](content/AUTHORING.md).

```bash
npm run content:validate                  # check every entry
node scripts/research.mjs pubmed "query"  # find and verify citations (PubMed, ClinicalTrials.gov, DailyMed)
node scripts/renumber-citations.mjs slug  # renumber citations in reading order
```

Articles are educational and not medical advice. Every citation was looked up and verified
against PubMed, ClinicalTrials.gov, DailyMed or the linked source.

## Generated assets

| Asset | Script | Source |
| --- | --- | --- |
| `public/models/{female,male}.glb` | `node scripts/build-body.mjs` | MakeHuman base mesh, targets and skeleton ([CC0 1.0](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md)), posed, subdivided, with baked ambient occlusion |
| `public/art/**` | `node scripts/build-art.cjs` | Procedural liquid-glass shader rendered in headless Chromium |
| `src/data/catalog.json` | `node scripts/build-catalog.mjs` | Compiled from `content/` |

The body models and artwork are original to this project; no third-party imagery is used.
