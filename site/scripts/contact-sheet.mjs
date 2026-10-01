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
  ["desktop-shadows-01-settled-high", "Settled: white cases, black type, one grey; caption on columns 1-3, neighbours on 10-12"],
  ["desktop-snapshot-03-turning", "Turning: the caption fades out while the rack moves"],
  ["desktop-snapshot-04-settled-after-keys", "After turning with the arrow keys"],
  ["desktop-index-01-index-hover", "Index: a plain list, the current row on a grey wash"],
  ["desktop-shadows-02-open-high", "Open: the case beside the spread, README as plain text"],
  ["desktop-snapshot-06-open-readme", "Open, another case"],
  ["sequence-close-on-turn-03-t0450ms", "Turning off an open case, 450 ms: shut, stepping back, swinging home"],
  ["sequence-close-on-turn-10-t1500ms", "1500 ms: the next case presented"],
  ["sequence-reflow-03-t0300ms", "Sort reflow, 300 ms: cases under the floor"],
  ["desktop-stress60-03-wheel-settled", "Sixty cases, settled"],
  ["desktop-stress60-02-wheel-turning", "Sixty cases, turning"],
  ["desktop-filter-02-filtered", "Filtered to 'atlas'"],
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
body{margin:0;background:#fff;font-family:system-ui,Arial,sans-serif;color:#000;padding:24px;width:1600px;box-sizing:border-box}
h1{font:400 20px system-ui,Arial,sans-serif;margin:0 0 16px}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
figure{margin:0}img{width:100%;display:block;border:1px solid #d9d9d9;background:#fff}
figcaption{font-size:12px;margin-top:6px;color:#767676}
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
