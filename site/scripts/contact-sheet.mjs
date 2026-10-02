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
  ["desktop-boot-01-first-paint", "Boot, first paint: the box being read"],
  ["desktop-boot-02-writing", "Boot: the current logo up, the disks filling as they are written"],
  ["desktop-shadows-01-settled-high", "Settled: the logo, the disk out of the box, the box lit at the foot"],
  ["desktop-inspect-02-back", "Turned over: the hub and the write-protect tab"],
  ["desktop-stress60-02-wheel-turning", "Sixty disks, flipping: the ones passed lean towards you"],
  ["desktop-snapshot-04-settled-after-keys", "After flipping with the arrow keys"],
  ["sequence-insert-01-in-t0150ms", "Into the drive, 150 ms: shutter open, turning on its side"],
  ["sequence-insert-09-in-read", "In the drive: the light on, the README read off the disk"],
  ["sequence-insert-10-out-t0120ms", "Eject, 120 ms: out of the slot before the sheet goes"],
  ["desktop-index-01-index-hover", "Index: every logo beside its name; the current row in negative"],
  ["sequence-reflow-03-t0300ms", "Sort reflow, 300 ms: disks under the floor"],
  ["desktop-filter-02-filtered", "Filtered to 'atlas'"],
  ["phone-stress60-01-settled", "Phone, settled"],
  ["phone-stress60-02-open", "Phone, open: the sheet full screen"],
  ["reduced-motion-02-after-key", "Reduced motion: instant states, no flicker"],
  ["flat-renderer-01-rest", "No WebGL: flat disks under the logo"],
];
const files = await readdir(dir);
const items = wanted.map(([k, label]) => ({ file: files.find((f) => f.startsWith(k)), label })).filter((x) => x.file);
// Embedded as data URIs: a page made with setContent cannot read file:// images.
for (const x of items) x.src = `data:image/png;base64,${(await readFile(path.join(dir, x.file))).toString("base64")}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#000;font-family:"Helvetica Neue",Helvetica,FreeSans,Arial,sans-serif;color:#fff;padding:24px;width:1600px;box-sizing:border-box}
h1{font:700 20px "Helvetica Neue",Helvetica,FreeSans,Arial,sans-serif;margin:0 0 16px}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
figure{margin:0}img{width:100%;display:block;border:1px solid #333;background:#000}
figcaption{font-size:12px;margin-top:6px;color:#8c8c8c}
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
