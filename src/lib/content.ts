import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Article } from "./article";

const dir = join(process.cwd(), "content/peptides");

/** The full article for a peptide, read at build time. Null until it has been written. */
export function getArticle(slug: string): Article | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const file = join(dir, `${slug}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")).article as Article;
  } catch {
    return null; // an entry mid-edit renders as "guide being written" rather than failing the build
  }
}
