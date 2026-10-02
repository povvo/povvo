import { type Entry, type Repo, stressEntries, toEntries } from "./catalogue";

export const OWNER = "povvo";
const LIVE = `https://api.github.com/users/${OWNER}/repos?per_page=100&type=owner&sort=created&direction=asc`;
const MAX_PAGES = 10;
const CACHE_KEY = "barrett-catalogue:repos:v1";
const CACHE_TTL = 60 * 60 * 1000;

export type Source = "live" | "cached" | "snapshot" | "stress";

export interface Catalogue {
  entries: Entry[];
  source: Source;
  generatedAt: string | null;
}

interface Snapshot {
  owner: string;
  generated_at: string;
  repos: Repo[];
}

function readCache(): { at: number; repos: Repo[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; repos: Repo[] };
    if (!Array.isArray(parsed.repos)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(repos: Repo[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repos }));
  } catch {
    /* storage may be unavailable; the snapshot still works */
  }
}

function normalise(raw: Record<string, unknown>[]): Repo[] {
  return raw
    .filter((r) => r && typeof r.name === "string" && r.private !== true)
    .map((r) => ({
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      html_url: r.html_url as string,
      language: (r.language as string | null) ?? null,
      stargazers_count: Number(r.stargazers_count ?? 0),
      forks_count: Number(r.forks_count ?? 0),
      topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
      created_at: r.created_at as string,
      pushed_at: (r.pushed_at as string) ?? (r.updated_at as string) ?? (r.created_at as string),
      default_branch: (r.default_branch as string) ?? "main",
      archived: Boolean(r.archived),
      fork: Boolean(r.fork),
    }));
}

async function fetchSnapshot(): Promise<Snapshot | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/repos.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    return (await res.json()) as Snapshot;
  } catch {
    return null;
  }
}

/** Reads every page of public repositories; a partial read is discarded rather than shown. */
async function fetchLive(): Promise<Repo[] | null> {
  try {
    const all: Record<string, unknown>[] = [];
    let complete = false;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(`${LIVE}&page=${page}`, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) return null;
      const raw = (await res.json()) as Record<string, unknown>[];
      if (!Array.isArray(raw)) return null;
      all.push(...raw);
      if (raw.length < 100) {
        complete = true;
        break;
      }
    }
    // A full last page means there may be more than MAX_PAGES hold: that is a partial read too.
    return complete && all.length ? normalise(all) : null;
  } catch {
    return null;
  }
}

/**
 * Loads the catalogue: the committed snapshot paints first; a live read of the public
 * GitHub API replaces it when available and is cached for an hour to respect the
 * unauthenticated rate limit. `?stress=60` synthesises a review set instead.
 */
export async function loadCatalogue(onFirst?: (c: Catalogue) => void): Promise<Catalogue> {
  const params = new URLSearchParams(location.search);
  const stress = Number(params.get("stress"));
  if (stress > 0) {
    const c: Catalogue = { entries: stressEntries(Math.min(stress, 400)), source: "stress", generatedAt: null };
    onFirst?.(c);
    return c;
  }

  const cached = readCache();
  const fresh = cached && Date.now() - cached.at < CACHE_TTL;
  let first: Catalogue | null = null;
  if (cached) {
    first = { entries: toEntries(cached.repos), source: "cached", generatedAt: new Date(cached.at).toISOString() };
  } else {
    const snap = await fetchSnapshot();
    if (snap) first = { entries: toEntries(snap.repos), source: "snapshot", generatedAt: snap.generated_at };
  }
  if (first) onFirst?.(first);
  if (fresh && first) return first;

  const live = await fetchLive();
  if (live) {
    writeCache(live);
    return { entries: toEntries(live), source: "live", generatedAt: new Date().toISOString() };
  }
  if (first) return first;
  throw new Error("The catalogue could not be loaded from GitHub or from the snapshot.");
}
