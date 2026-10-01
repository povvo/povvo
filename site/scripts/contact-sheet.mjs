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
  ["desktop-shadows-01-settled-high", "Settled: the logo across the top, the case standing in front of its foot, Helvetica at the foot"],
  ["desktop-stress60-03-wheel-settled", "Sixty cases: the rack in the dark, the presented case in the light"],
  ["desktop-snapshot-03-turning", "Turning: the logo and the caption go while the rack moves"],
  ["desktop-index-01-index-hover", "Index: a tape trader's list, every logo beside its name; the current row in negative"],
  ["desktop-shadows-02-open-high", "Open: the case's insert as a photocopied sheet, the README in Helvetica"],
  ["desktop-snapshot-06-open-readme", "Open, another case: the sheet and the disc"],
  ["sequence-close-on-turn-03-t0450ms", "Turning off an open case, 450 ms: shut, stepping back, swinging home"],
  ["sequence-close-on-turn-10-t1500ms", "1500 ms: the next case presented, its logo opening from the centre"],
  ["sequence-reflow-03-t0300ms", "Sort reflow, 300 ms: cases under the floor"],
  ["desktop-filter-02-filtered", "Filtered to 'atlas'"],
  ["desktop-snapshot-04-settled-after-keys", "After turning with the arrow keys"],
  ["desktop-stress60-02-wheel-turning", "Sixty cases, turning"],
  ["phone-stress60-01-settled", "Phone, settled"],
  ["phone-stress60-02-open", "Phone, open: the sheet full screen"],
  ["reduced-motion-02-after-key", "Reduced motion: instant states, no flicker"],
  ["flat-renderer-01-rest", "No WebGL: the flat rack under the logo"],
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
