# Authoring peptide entries

Every peptide in the library is one JSON file: `content/peptides/<slug>.json`.
The master list of slugs, display names, zones and status categories is
`content/index.json`; an entry's `slug`, `zone` and `category` must match it.

Run the validator after writing or editing entries:

```bash
node scripts/validate-content.mjs                 # everything
node scripts/validate-content.mjs semaglutide bpc-157   # just these
```

Use the research helper to find and verify every citation (it handles the
proxy and NCBI rate limits):

```bash
node scripts/research.mjs pubmed "semaglutide obesity Wilding 2021" 5
node scripts/research.mjs pmid 33567185
node scripts/research.mjs nct NCT03548935
node scripts/research.mjs ctgov "retatrutide obesity" 5
node scripts/research.mjs dailymed "semaglutide" 3
node scripts/research.mjs url https://www.fda.gov/...
```

## File shape

```jsonc
{
  "slug": "semaglutide",
  "name": "Semaglutide",                  // display name, from index.json
  "zone": "digestive",
  "category": "fda",                      // fda | clinical | wellness | cosmetic
  "aliases": ["NN9535"],                  // research codes, chemical or older names; [] if none
  "brands": ["Ozempic", "Wegovy", "Rybelsus"],   // US brand names; [] if none
  "class": "GLP-1 receptor agonist",      // drug class, max 56 chars, aim for under 36
  "route": "Weekly injection under the skin, or a daily tablet",  // plain English, max 90 chars
  "status": "FDA-approved for type 2 diabetes (2017) and weight management (2021)", // US status, max 150 chars
  "evidence": 4,                          // 1-4, see rubric
  "mechanism": "Mimics the gut hormone GLP-1 to raise insulin, slow digestion and turn down appetite", // one sentence, max 170 chars, no final period
  "uses": ["Type 2 diabetes", "Chronic weight management", "Heart attack and stroke risk"], // 1-5 short phrases
  "popular": 2,                           // copy from index.json (number or null)
  "related": ["tirzepatide", "liraglutide", "retatrutide"],     // 2-5 slugs from index.json, any zone, never itself
  "article": {
    "summary": "…",                      // 120-200 chars, plain text: what it is, what it's for, status. Used as meta description.
    "takeaway": "…",                     // rich text, 3-5 sentences: the most important things to know
    "glance": [                          // 4-7 rows of [label, value]; value is rich text
      ["FDA status", "…"],
      ["Main uses", "…"],
      ["How it's taken", "…"],
      ["Drug class", "…"],
      ["Research", "…"]
    ],
    "sections": [                        // 4-7 sections, see "Sections" below
      { "id": "how-it-works", "title": "How it works", "blocks": [ { "type": "p", "text": "…" } ] }
    ],
    "evidence": { "label": "Strong: several large randomized trials", "text": "…" },  // label max 60 chars; text rich, 2-4 sentences
    "faq": [ { "q": "…?", "a": "…" } ],  // 3-5 real questions people ask; answers rich text, 1-4 sentences
    "citations": [                       // 3-8 entries, every one verified with scripts/research.mjs
      {
        "n": 1,
        "title": "Once-Weekly Semaglutide in Adults with Overweight or Obesity",
        "source": "N Engl J Med",        // journal, "ClinicalTrials.gov", "DailyMed (FDA label)", "U.S. FDA", …
        "year": 2021,
        "url": "https://pubmed.ncbi.nlm.nih.gov/33567185/",
        "pmid": "33567185",              // when it is a PubMed record
        "doi": "10.1056/NEJMoa2032183",  // when the record has one
        "note": "STEP 1: 68-week weight outcomes versus placebo"   // max 90 chars: why it is cited
      }
    ],
    "updated": "2026-10-27"
  }
}
```

### Block types (inside `sections[].blocks`)

- `{ "type": "p", "text": "…" }` paragraph
- `{ "type": "ul", "items": ["…", "…"] }` bullet list (2-6 items)
- `{ "type": "ol", "items": ["…", "…"] }` numbered list
- `{ "type": "h3", "text": "…" }` small subheading (use sparingly)
- `{ "type": "note", "text": "…" }` small grey aside
- `{ "type": "table", "header": true, "rows": [["Trial", "Result"], ["…", "…"]] }` compact table, 2-3 columns, max 6 rows

### Rich text

`takeaway`, block `text`/`items`, table cells, glance values, `evidence.text` and FAQ answers accept:

- `**bold**` for a few key facts (not whole sentences)
- `[label](/peptides/<slug>)` link to another library entry (slug must exist in index.json)
- `[label](https://…)` external link (only URLs you have checked)
- `[^2]` citation marker, placed after the punctuation it supports, pointing at `citations[n=2]`

Every citation must be referenced by at least one `[^n]` marker, and every marker must have a citation.
Number citations in order of first appearance.

## Evidence rubric

| value | label shown | meaning |
| --- | --- | --- |
| 4 | FDA approved | Approved drug: regulatory-grade evidence. Every `fda` entry is 4. |
| 3 | Deep research | Multiple randomized human trials (late-stage clinical candidates, well-studied ingredients). |
| 2 | Moderate research | Some human data: small or early trials, pilot studies. |
| 1 | Low research | Mostly cell and animal studies, case reports, anecdote. |

`evidence.label` in the article is your own one-line verdict ("Promising but early: animal studies only").

## Sections

Pick 4-7 sections that fit the entry and its category. Use these ids/titles where they apply
(ids are kebab-case and unique within the article):

- **fda**: `how-it-works` How it works · `what-its-used-for` What it's used for · `what-the-research-shows` What the research shows · `how-its-taken` How it's taken · `side-effects-and-safety` Side effects and safety · `who-should-avoid-it` Who should avoid it (optional) · `regulatory-status` FDA status (optional)
- **clinical**: `how-it-works` How it works · `where-it-is-in-development` Where it is in development · `what-the-trials-show` What the trials show · `safety-so-far` Safety so far · `whats-next` What's next
- **wellness** (not FDA-approved): `how-its-thought-to-work` How it's thought to work · `what-the-research-shows` What the research shows · `safety-and-unknowns` Safety and unknowns · `legal-and-regulatory-status` Legal and regulatory status · `bottom-line` Bottom line
- **cosmetic**: `how-it-works-in-skin` How it works in skin · `what-the-studies-show` What the studies show · `how-its-used` How it's used · `safety` Safety · `bottom-line` Bottom line

## Writing rules

1. **Original words only.** Do not copy or closely paraphrase any website, label or article. Facts are fine; phrasing must be yours.
2. **Accurate and current.** Write as of late October 2026, US perspective. Regulatory status must be right. If you are not sure something is still true, say "as of 2026" or leave it out. Never invent a trial, number, approval or date.
3. **Calm, plain English.** Short sentences. Explain jargon on first use ("GLP-1, a gut hormone that…"). No hype, no marketing, no exclamation marks, no "miracle", "game-changer", "unlock".
4. **Numbers with sources.** Specific results (percent weight loss, fracture reduction, trial size) get a `[^n]` citation.
5. **Safety first.** Cover common side effects, serious risks, boxed warnings and who should not use it. For wellness and research compounds be explicit about what is unknown, the quality and contamination risks of gray-market products, and sports anti-doping status where relevant (WADA).
6. **No dosing protocols for unapproved compounds.** For FDA-approved drugs you may describe the approved route, frequency and general dose range from the label. For wellness, research and compounded products never give doses, cycles or stacking advice.
7. **Not medical advice.** Don't tell readers to start or stop anything. Where natural, note that decisions belong with a clinician, but don't repeat it in every answer.
8. **Length.** About 500-900 words per article across all fields. Grouped entries ("Insulin analogs", "Echinocandins") may run longer.
9. **Typography.** Use straight quotes in JSON. Use "-" for ranges (2-4 weeks). Avoid em dashes; use commas, colons or parentheses instead.

## Citations

- Prefer: the pivotal trial(s), a recent systematic review or meta-analysis, the FDA label (DailyMed), the ClinicalTrials.gov record for ongoing trials, and FDA or WADA pages for regulatory facts.
- Verify each one with `scripts/research.mjs` before using it. Copy title, journal, year, PMID and DOI from the tool output, not from memory.
- URL formats: PubMed `https://pubmed.ncbi.nlm.nih.gov/<pmid>/`, trials `https://clinicaltrials.gov/study/<NCT>`, labels `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=<setid>`. Other URLs only after `research.mjs url` returns 200.
- If you cannot verify a source, drop it and the claim that depended on it.
