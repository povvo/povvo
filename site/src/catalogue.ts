/** Pure catalogue helpers: numbering, shells, titles, ordering. No DOM, no three.js. */

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
  /** Index into SHELLS: the case colour. */
  shell: number;
  /** Cover layout (recipe/direction-v2.md, cover system). */
  layout: Layout;
  /** Display title: the slug with hyphens and underscores as spaces. */
  title: string;
  /** Four-digit year of the last push. */
  year: string;
  /** Four-digit year the repository was created. */
  born: string;
  /** Short language code for spines and lines. */
  code: string;
  /** Capsule code printed on the case and the caption, e.g. ELB-PY-26. */
  capsule: string;
}

export type Layout = "quilt" | "block" | "horizon" | "specimen";

export interface Shell {
  name: string;
  hex: string;
  /** Text printed on this shell, chosen by measured contrast (recipe/direction-v2.md, tokens). */
  text: string;
  /** The collision colour this shell is paired with on covers. */
  accent: string;
}

export const FIELD = { sky: "#CFE6DF", paper: "#F8F1DF", sand: "#EFE3C1", dust: "#D8BE83", bone: "#F4EFE1" } as const;
export const INK = "#111719";
export const PAPER = "#F8F1DF";
export const SIGNAL = "#E7202E";

/**
 * Hot shells from the patchwork palette, ordered so neighbours alternate warm, cool, dark and
 * light. Text on each is the measured better of ink and paper (all at or above 4.5).
 * Bone is reserved for the specimen layout.
 */
export const SHELLS: Shell[] = [
  { name: "teal", hex: "#008C9A", text: INK, accent: "#FF4B1F" },
  { name: "orange", hex: "#FF4B1F", text: INK, accent: "#0B1BA2" },
  { name: "violet", hex: "#5200DC", text: PAPER, accent: "#2EFFE3" },
  { name: "acid", hex: "#EFE61B", text: INK, accent: "#2E5B2D" },
  { name: "indigo", hex: "#0B1BA2", text: PAPER, accent: "#BAA07F" },
  { name: "pink", hex: "#F59AC7", text: INK, accent: "#2E5B2D" },
  { name: "forest", hex: "#2E5B2D", text: PAPER, accent: "#F59AC7" },
  { name: "aqua", hex: "#2EFFE3", text: INK, accent: "#5200DC" },
  { name: "magenta", hex: "#AE3571", text: PAPER, accent: "#9EAA75" },
  { name: "lime", hex: "#DDEB28", text: INK, accent: "#5D0E1A" },
  { name: "petrol", hex: "#092E35", text: PAPER, accent: "#FF4B1F" },
  { name: "red", hex: "#DA0028", text: PAPER, accent: "#14C9F8" },
  { name: "sage", hex: "#9EAA75", text: INK, accent: "#AE3571" },
  { name: "brown", hex: "#8A4C0A", text: PAPER, accent: "#2EFFE3" },
  { name: "sky", hex: "#14C9F8", text: INK, accent: "#DA0028" },
  { name: "oxblood", hex: "#5D0E1A", text: PAPER, accent: "#EFE61B" },
];
export const BONE: Shell = { name: "bone", hex: FIELD.bone, text: INK, accent: SIGNAL };

/** Eleven layouts against sixteen shells: the two cycles are coprime, so pairings keep varying. */
const LAYOUT_CYCLE: Layout[] = ["quilt", "block", "horizon", "quilt", "specimen", "block", "quilt", "horizon", "block", "quilt", "horizon"];

export function shellOf(entry: Entry): Shell {
  return entry.layout === "specimen" ? BONE : SHELLS[entry.shell];
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

export function formatNo(no: number): string {
  return `No. ${String(no).padStart(3, "0")}`;
}

/** Position in the current order, printed as 04 / 11. */
export function pad2(n: number, total: number): string {
  return String(n).padStart(String(total).length < 2 ? 2 : String(total).length, "0");
}

export function position(index: number, total: number): string {
  return `${pad2(index + 1, total)} / ${pad2(total, total)}`;
}

export function capsuleOf(code: string, born: string): string {
  const c = code === "—" ? "DOC" : code.replace(/[^A-Z0-9+#]/g, "").slice(0, 5);
  return `ELB-${c}-${born.slice(2)}`;
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
    const born = yearOf(r.created_at);
    return {
      ...r,
      topics: r.topics ?? [],
      no,
      shell: (no - 1) % SHELLS.length,
      layout: LAYOUT_CYCLE[(no - 1) % LAYOUT_CYCLE.length],
      title: displayTitle(r.name),
      year: yearOf(r.pushed_at || r.created_at),
      born,
      code,
      capsule: capsuleOf(code, born),
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
  const hay = [entry.name, entry.title, entry.description ?? "", entry.language ?? "", entry.topics.join(" "), entry.capsule]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}

export function metaLine(entry: Entry): string {
  const parts = [entry.language ?? "No language", `Updated ${dateLine(entry.pushed_at || entry.created_at)}`];
  if (entry.stargazers_count > 0) parts.push(`${entry.stargazers_count} ★`);
  if (entry.archived) parts.push("Archived");
  return parts.join(" — ");
}

export function dateLine(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
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
