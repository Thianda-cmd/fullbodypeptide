# fullbody · The Peptide Atlas

An interactive 3D atlas of 152 peptides — FDA-approved drugs, clinical-trial candidates,
gray-market compounds and skincare actives — placed on the part of the body they act on.

- **Design**: a printed-atlas look of warm paper, ink and one cobalt signal colour, with
  Instrument Serif headings and mono figure labels.
- **3D body** (female and male), rendered as an engraving whose contour lines thicken in shadow,
  with eight body zones. Hover or pick a zone to fly the camera
  there; each zone has its own animated highlight (neural pulses, heartbeat and circulation,
  lymph nodes, thyroid, joints, skin aura…). Drag to rotate.
- **Sequence glyphs**: every peptide has its own ball-and-stick drawing of a residue chain,
  generated from its slug (`src/lib/glyph.ts`) and drawn on canvas and as SVG. The glyphs are
  decorative and do not encode real sequences.
- **3D shelf** of every peptide as an index card in perspective, with an elastic scroll, staggered
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
| `src/data/catalog.json` | `node scripts/build-catalog.mjs` | Compiled from `content/` |

The body models, glyphs and brand are original to this project; no third-party imagery is used.
