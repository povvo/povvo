#!/usr/bin/env node
/**
 * Layout measurement (ui-layout-composition: infer alignment axes). Serves dist/, settles the
 * rack, and records the boxes of every visible chrome text block and control at 1440 by 900,
 * as input for infer_alignment_axes.py. The 3D objects are not boxes in the DOM and are left out.
 * Usage: node scripts/measure-layout.mjs <out.json> [query]
 */
import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "..", "dist");
const [out = "layout.json", query = "?quality=low&review=1"] = process.argv.slice(2);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route((u) => u.protocol === "https:", (r) => r.abort());
await page.goto(`http://localhost:${server.address().port}/${query}`);
await page.waitForFunction(() => document.body.dataset.state && document.body.dataset.state !== "loading");
await page.evaluate(() => window.__rack?.snap());
await page.waitForTimeout(900);
await page.evaluate(() => window.__rack?.snap());
await page.waitForTimeout(900);
const nodes = await page.evaluate(() => {
  const picks = document.querySelectorAll("h1, h2, h3, p, button, a, label, .capsule, .track, .hero__line, [data-measure]");
  const outNodes = [];
  let i = 0;
  for (const el of picks) {
    if (el.closest("[hidden]") || el.closest(".sr-only") || el.classList.contains("sr-only") || el.closest("noscript")) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    if (el.classList.contains("track") && el.previousElementSibling) continue; // one row stands for the list
    const name = `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}#${i++}`;
    outNodes.push({ id: name, x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) });
  }
  return outNodes;
});
await writeFile(out, JSON.stringify({ tolerance: 3, minimum_support: 2, nodes }, null, 2));
console.log(`${nodes.length} nodes -> ${out}`);
await browser.close();
server.close();
