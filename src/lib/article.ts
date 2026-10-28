export type Block =
  | { type: "p" | "h3" | "note"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "table"; header?: boolean; rows: string[][] };

export interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

export interface Citation {
  n: number;
  title: string;
  source: string;
  year: number;
  url: string;
  pmid?: string;
  doi?: string;
  note?: string;
}

export interface Article {
  summary: string;
  takeaway: string;
  glance: [string, string][];
  sections: Section[];
  evidence: { label: string; text: string };
  faq: { q: string; a: string }[];
  citations: Citation[];
  updated: string;
}

export function formatDate(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
