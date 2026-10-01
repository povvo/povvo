#!/usr/bin/env node
/** Composes the review frames into one contact sheet (JPEG) for the recipe record. */
import path from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "..", "recipe", "evidence", "review");
const out = path.join(here, "..", "recipe", "evidence", "contact-sheet.jpg");
const wanted = [
  ["desktop-snapshot-01-arrival", "Arrival, 0.3 s: rack turning in, inserts not yet painted"],
  ["desktop-snapshot-02-settled", "Settled: the chosen case out front"],
  ["desktop-snapshot-03-turning", "Turning after three key presses: case retracted"],
  ["desktop-shadows-01-settled-high", "Full quality: shadows and coat"],
  ["desktop-snapshot-06-open-readme", "Open: the booklet with the README"],
  ["desktop-shadows-02-open-high", "Open, full quality: the spread"],
  ["desktop-stress60-01-settled", "Sixty cases, settled"],
  ["desktop-stress60-03-wheel-settled", "Sixty cases after a wheel turn"],
  ["desktop-stress60-06-open", "Sixty cases, open"],
  ["desktop-filter-01-filtered", "Index filtered to 'atlas': the rack follows"],
  ["phone-stress60-01-settled", "Phone, settled"],
  ["phone-stress60-02-open", "Phone, open: full sheet"],
  ["reduced-motion-02-after-key", "Reduced motion: instant states"],
  ["flat-renderer-01-rest", "No WebGL: the flat rack"],
  ["flat-renderer-02-open", "No WebGL, open"],
];
const files = await readdir(dir);
const items = wanted.map(([k, label]) => ({ file: files.find((f) => f.startsWith(k)), label })).filter((x) => x.file);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#E9E5DD;font-family:Arial,sans-serif;color:#221F1C;padding:24px;width:1600px;box-sizing:border-box}
h1{font:400 22px Georgia,serif;margin:0 0 16px}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
figure{margin:0}img{width:100%;display:block;border:1px solid #C9C3B8;background:#fff}
figcaption{font-size:12px;margin-top:6px;color:#6B655C}
</style></head><body><h1>Review frames, ${new Date().toISOString().slice(0,10)}, headless Chromium with SwiftShader (not a representative GPU)</h1><div class="g">
${items.map((x) => `<figure><img src="file://${path.join(dir, x.file)}"><figcaption>${x.label}<br>${x.file}</figcaption></figure>`).join("\n")}
</div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.setContent(html, { waitUntil: "load" });
await page.waitForTimeout(500);
await page.screenshot({ path: out, fullPage: true, type: "jpeg", quality: 78 });
await browser.close();
console.log("wrote", out, items.length, "frames");
