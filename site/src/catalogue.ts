/** Pure catalogue helpers: numbering, titles, ordering. No DOM, no three.js. */

export interface Repo {
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  created_at: string;
  pushed_at: string;
  default_branch: string;
  archived: boolean;
  fork: boolean;
}

export interface Entry extends Repo {
  /** Accession number: order of repository creation, 1-based. Identity and default order. */
  no: number;
  /** Display title: the slug with hyphens and underscores as spaces. */
  title: string;
  /** Four-digit year of the last push. */
  year: string;
  /** Four-digit year the repository was created. */
  born: string;
  /** Short language code for spines and lines. */
  code: string;
}

/** Repositories that are infrastructure for the profile rather than work. */
export const META_REPOS = new Set([".github", "povvo"]);

const CODES: Record<string, string> = {
  TypeScript: "TS",
  JavaScript: "JS",
  Python: "PY",
  Shell: "SH",
  PowerShell: "PS",
  HTML: "HTML",
  CSS: "CSS",
  Lua: "LUA",
  Rust: "RS",
  Go: "GO",
  "C++": "C++",
  C: "C",
  "C#": "C#",
  Java: "JAVA",
  Kotlin: "KT",
  Swift: "SWIFT",
  Ruby: "RB",
  PHP: "PHP",
  "Jupyter Notebook": "IPYNB",
  Dockerfile: "DOCKER",
  Makefile: "MAKE",
  Markdown: "MD",
};

export function languageCode(language: string | null): string {
  if (!language) return "—";
  return CODES[language] ?? language.toUpperCase().slice(0, 6);
}

export function displayTitle(name: string): string {
  return name.replace(/[-_]+/g, " ").trim();
}

/** Position in the current order, printed as 04 / 11. */
export function pad2(n: number, total: number): string {
  return String(n).padStart(String(total).length < 2 ? 2 : String(total).length, "0");
}

export function position(index: number, total: number): string {
  return `${pad2(index + 1, total)} / ${pad2(total, total)}`;
}

export function yearOf(iso: string): string {
  return iso.slice(0, 4);
}

/** Accession: sort by creation date, number from 1. Meta repos and forks are excluded. */
export function toEntries(repos: Repo[]): Entry[] {
  const work = repos.filter((r) => !META_REPOS.has(r.name) && !r.fork);
  work.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name));
  return work.map((r, i) => {
    const no = i + 1;
    const code = languageCode(r.language);
    return {
      ...r,
      topics: r.topics ?? [],
      no,
      title: displayTitle(r.name),
      year: yearOf(r.pushed_at || r.created_at),
      born: yearOf(r.created_at),
      code,
    };
  });
}

export type Order = "accession" | "updated" | "name" | "stars";

export function orderEntries(entries: Entry[], order: Order): Entry[] {
  const copy = entries.slice();
  switch (order) {
    case "updated":
      copy.sort((a, b) => b.pushed_at.localeCompare(a.pushed_at));
      break;
    case "name":
      copy.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "stars":
      copy.sort((a, b) => b.stargazers_count - a.stargazers_count || a.no - b.no);
      break;
    default:
      copy.sort((a, b) => a.no - b.no);
  }
  return copy;
}

export function matches(entry: Entry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [entry.name, entry.title, entry.description ?? "", entry.language ?? "", entry.topics.join(" ")]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}

export function metaLine(entry: Entry): string {
  const parts = [entry.language ?? "No language", `updated ${dateLine(entry.pushed_at || entry.created_at)}`];
  if (entry.stargazers_count > 0) parts.push(`${entry.stargazers_count} ${entry.stargazers_count === 1 ? "star" : "stars"}`);
  if (entry.archived) parts.push("archived");
  return parts.join(", ");
}

export function dateLine(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Deterministic stress set for review: synthetic names, real structure. */
export function stressEntries(count: number): Entry[] {
  const langs = ["Python", "TypeScript", "Shell", "HTML", "Lua", "Rust", null, "PowerShell"];
  const words = ["study", "atlas", "ledger", "signal", "kitchen", "orbit", "quiet", "paper", "field", "margin", "pleat", "drum"];
  const repos: Repo[] = [];
  for (let i = 0; i < count; i++) {
    const a = words[i % words.length];
    const b = words[(i * 7 + 3) % words.length];
    const extra = i % 5 === 0 ? `-${words[(i * 11 + 5) % words.length]}-${words[(i * 13 + 1) % words.length]}` : "";
    const name = `${a}-${b}${extra}-${String(i + 1).padStart(2, "0")}`;
    const month = String((i % 12) + 1).padStart(2, "0");
    repos.push({
      name,
      description: i % 3 === 0 ? `A ${a} for ${b}, with sources, a validator and a worked example.` : null,
      html_url: `https://github.com/povvo/${name}`,
      language: langs[i % langs.length],
      stargazers_count: i % 9 === 0 ? (i * 13) % 140 : 0,
      forks_count: 0,
      topics: [],
      created_at: `2026-${month}-${String((i % 27) + 1).padStart(2, "0")}T12:00:00Z`,
      pushed_at: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T12:00:00Z`,
      default_branch: "main",
      archived: false,
      fork: false,
    });
  }
  return toEntries(repos);
}
