/*
 * Service worker (recipe/direction-v4.md, loading). Same-origin only; GitHub's API and READMEs
 * are never touched here.
 *   assets/*  hashed build files, immutable: cache first.
 *   pages and data/repos.json: network first, the cache only when offline, so a deploy shows
 *   at once and a repeat visit without a network still opens.
 * Bump VERSION to drop everything cached by an older worker.
 */
const VERSION = "v4-1";
const SHELL = `elb-shell-${VERSION}`;
const ASSETS = `elb-assets-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(["./", "./data/repos.json", "./favicon.svg"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith("elb-") && !n.startsWith("elb-art-") && n !== SHELL && n !== ASSETS).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone()).catch(() => undefined);
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone()).catch(() => undefined);
    return res;
  } catch (err) {
    const hit = (await cache.match(request)) || (request.mode === "navigate" ? await cache.match("./") : undefined);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/__art/")) return;
  if (url.pathname.includes("/assets/")) event.respondWith(cacheFirst(request));
  else if (request.mode === "navigate" || url.pathname.endsWith("/data/repos.json")) event.respondWith(networkFirst(request));
});
