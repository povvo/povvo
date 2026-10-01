#!/usr/bin/env node
/**
 * Refreshes public/data/repos.json from the GitHub API at build time.
 * Uses GITHUB_TOKEN when present. On any failure the existing snapshot is kept
 * and the script exits 0, so a deploy never fails because of the API.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const OWNER = process.env.CATALOGUE_OWNER || "povvo";
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "public", "data", "repos.json");

const headers = { Accept: "application/vnd.github+json", "User-Agent": "barrett-catalogue" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function page(n) {
  const url = `https://api.github.com/users/${OWNER}/repos?per_page=100&type=owner&sort=created&direction=asc&page=${n}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

function pick(r) {
  return {
    name: r.name,
    description: r.description ?? null,
    html_url: r.html_url,
    language: r.language ?? null,
    stargazers_count: r.stargazers_count ?? 0,
    forks_count: r.forks_count ?? 0,
    topics: Array.isArray(r.topics) ? r.topics : [],
    created_at: r.created_at,
    pushed_at: r.pushed_at ?? r.updated_at ?? r.created_at,
    default_branch: r.default_branch ?? "main",
    archived: Boolean(r.archived),
    fork: Boolean(r.fork),
  };
}

try {
  const repos = [];
  for (let n = 1; n <= 10; n++) {
    const batch = await page(n);
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const r of batch) if (!r.private) repos.push(pick(r));
    if (batch.length < 100) break;
  }
  if (repos.length === 0) throw new Error("no public repositories returned");
  const snapshot = { owner: OWNER, generated_at: new Date().toISOString(), source: "github-api", repos };
  await writeFile(out, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Snapshot written: ${repos.length} public repositories for ${OWNER}.`);
} catch (error) {
  let existing = 0;
  try {
    existing = JSON.parse(await readFile(out, "utf8")).repos.length;
  } catch {
    /* no snapshot yet */
  }
  console.warn(`Snapshot not refreshed (${error.message}); keeping the committed snapshot with ${existing} repositories.`);
}
