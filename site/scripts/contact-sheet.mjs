#!/usr/bin/env node
/** Composes the review frames into one contact sheet (JPEG) for the recipe record. */
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "..", "recipe", "evidence", "review");
const out = path.join(here, "..", "recipe", "evidence", "contact-sheet.jpg");
const wanted = [
  ["desktop-snapshot-01-arrival", "Arrival: the patchwork title card cut away tile by tile"],
  ["desktop-shadows-01-settled-high", "Settled: one grid; case in the sky, rack on the horizon, the word at the foot"],
  ["desktop-snapshot-04-settled-after-keys", "After turning: caption on columns 1-3, neighbours on 10-12"],
  ["desktop-snapshot-03-turning", "Turning: the word drops out, the rack drifts"],
  ["desktop-index-01-index-hover", "Index: full-screen tracklist, cover following the pointer"],
  ["desktop-snapshot-06-open-readme", "Open: the case beside the spread, quilt slab, README"],
  ["sequence-close-on-turn-03-t0450ms", "Turning off an open case, 450 ms: shut, stepping back, swinging home"],
  ["sequence-close-on-turn-10-t1500ms", "1500 ms: the next case presented"],
  ["sequence-reflow-03-t0300ms", "Sort reflow, 300 ms: cases under the floor"],
  ["desktop-stress60-03-wheel-settled", "Sixty cases, settled"],
  ["desktop-stress60-02-wheel-turning", "Sixty cases, turning; the cursor says View"],
  ["desktop-filter-02-filtered", "Filtered to 'atlas': two-line title, the case just over its top edge"],
  ["phone-stress60-01-settled", "Phone, settled"],
  ["phone-stress60-02-open", "Phone, open: full-screen spread"],
  ["reduced-motion-02-after-key", "Reduced motion: instant states"],
  ["flat-renderer-01-rest", "No WebGL: the flat rack"],
];
const files = await readdir(dir);
const items = wanted.map(([k, label]) => ({ file: files.find((f) => f.startsWith(k)), label })).filter((x) => x.file);
// Embedded as data URIs: a page made with setContent cannot read file:// images.
for (const x of items) x.src = `data:image/png;base64,${(await readFile(path.join(dir, x.file))).toString("base64")}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#EFE3C1;font-family:Arial,sans-serif;color:#111719;padding:24px;width:1600px;box-sizing:border-box}
h1{font:400 22px Georgia,serif;margin:0 0 16px}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
figure{margin:0}img{width:100%;display:block;border:1px solid #111719;background:#fff}
figcaption{font-size:12px;margin-top:6px;color:#4A5355}
</style></head><body><h1>Review frames, ${new Date().toISOString().slice(0,10)}, headless Chromium with SwiftShader (not a representative GPU)</h1><div class="g">
${items.map((x) => `<figure><img src="${x.src}"><figcaption>${x.label}<br>${x.file}</figcaption></figure>`).join("\n")}
</div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.setContent(html, { waitUntil: "load" });
await page.waitForTimeout(500);
await page.screenshot({ path: out, fullPage: true, type: "jpeg", quality: 78 });
await browser.close();
console.log("wrote", out, items.length, "frames");
