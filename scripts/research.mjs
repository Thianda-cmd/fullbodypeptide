#!/usr/bin/env node
// Research helper for content authors: look up and verify citations against
// PubMed, ClinicalTrials.gov and DailyMed before they go into an article.
//
//   node scripts/research.mjs pubmed "semaglutide STEP 1 Wilding" [max=8]
//   node scripts/research.mjs pmid 33567185,35441470
//   node scripts/research.mjs nct NCT03548935
//   node scripts/research.mjs ctgov "retatrutide obesity" [max=8]
//   node scripts/research.mjs dailymed "semaglutide"
//   node scripts/research.mjs url https://www.fda.gov/...
//
// Node's fetch only honours HTTPS_PROXY when NODE_USE_ENV_PROXY=1, so the
// script re-executes itself with that set when a proxy is configured.

import { spawnSync } from "node:child_process";

if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, ["--no-warnings", ...process.argv.slice(1)], {
    stdio: "inherit",
    env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
  });
  process.exit(r.status ?? 1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastNcbi = 0;

async function get(url, { json = true, ncbi = false } = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (ncbi) {
      // NCBI allows ~3 requests/second without a key; several authors share the IP.
      const wait = lastNcbi + 1100 - Date.now();
      if (wait > 0) await sleep(wait);
      lastNcbi = Date.now();
    }
    try {
      const res = await fetch(url, { headers: { "user-agent": "fullbodypeptide-research/1.0" } });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!json) return res;
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt === 5) throw err;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw new Error(`gave up: ${url}`);
}

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

async function pubmedSummaries(ids) {
  if (ids.length === 0) return [];
  const j = await get(`${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`, { ncbi: true });
  return (j.result?.uids ?? []).map((id) => {
    const x = j.result[id];
    const doi = (x.articleids ?? []).find((a) => a.idtype === "doi")?.value ?? null;
    return {
      pmid: id,
      title: x.title,
      journal: x.source,
      year: Number(String(x.pubdate ?? "").slice(0, 4)) || null,
      firstAuthor: x.authors?.[0]?.name ?? null,
      pubtype: (x.pubtype ?? []).join("; "),
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    };
  });
}

function print(rows) {
  for (const r of rows) console.log(JSON.stringify(r));
  if (rows.length === 0) console.log("(no results)");
}

const [cmd, arg, maxArg] = process.argv.slice(2);
const max = Math.min(Number(maxArg) || 8, 20);

switch (cmd) {
  case "pubmed": {
    const j = await get(
      `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${max}&term=${encodeURIComponent(arg)}`,
      { ncbi: true },
    );
    print(await pubmedSummaries(j.esearchresult?.idlist ?? []));
    break;
  }
  case "pmid": {
    print(await pubmedSummaries(arg.split(",").map((s) => s.trim()).filter(Boolean)));
    break;
  }
  case "nct": {
    const j = await get(`https://clinicaltrials.gov/api/v2/studies/${arg}`);
    const p = j.protocolSection;
    print([
      {
        nct: p.identificationModule.nctId,
        title: p.identificationModule.briefTitle,
        status: p.statusModule?.overallStatus,
        phases: p.designModule?.phases ?? [],
        sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name,
        start: p.statusModule?.startDateStruct?.date,
        url: `https://clinicaltrials.gov/study/${p.identificationModule.nctId}`,
      },
    ]);
    break;
  }
  case "ctgov": {
    const j = await get(
      `https://clinicaltrials.gov/api/v2/studies?pageSize=${max}&query.term=${encodeURIComponent(arg)}`,
    );
    print(
      (j.studies ?? []).map(({ protocolSection: p }) => ({
        nct: p.identificationModule.nctId,
        title: p.identificationModule.briefTitle,
        status: p.statusModule?.overallStatus,
        phases: p.designModule?.phases ?? [],
        sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name,
        url: `https://clinicaltrials.gov/study/${p.identificationModule.nctId}`,
      })),
    );
    break;
  }
  case "dailymed": {
    const j = await get(
      `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?pagesize=${max}&drug_name=${encodeURIComponent(arg)}`,
    );
    print(
      (j.data ?? []).map((x) => ({
        setid: x.setid,
        title: x.title,
        published: x.published_date,
        url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${x.setid}`,
      })),
    );
    break;
  }
  case "url": {
    const res = await get(arg, { json: false });
    console.log(JSON.stringify({ url: arg, status: res.status, final: res.url }));
    break;
  }
  default:
    console.log("usage: research.mjs pubmed|pmid|nct|ctgov|dailymed|url <arg> [max]");
    process.exit(1);
}
