#!/usr/bin/env node
/**
 * Review frames: serves dist/ and captures representative states with Playwright.
 * Usage: node scripts/review.mjs [--out recipe/evidence/review] [--only name]
 * Expects a Playwright install reachable through NODE_PATH or node_modules.
 */
import http from "node:http";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "..", "dist");
const args = process.argv.slice(2);
const outDir = path.resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : path.join(here, "..", "recipe", "evidence", "review"));
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
await mkdir(outDir, { recursive: true });

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://localhost:${port}/`;

// Headless Chromium cannot use this environment's agent proxy, so external reads (READMEs,
// the GitHub API) are fetched with curl, which can, and handed back to the page.
const execFileP = promisify(execFile);
async function viaCurl(route) {
  const url = route.request().url();
  const tmp = path.join(os.tmpdir(), `review-${process.pid}-${Math.random().toString(36).slice(2)}`);
  try {
    const { stdout } = await execFileP("curl", ["-sS", "-L", "--max-time", "20", "-o", tmp, "-w", "%{http_code} %{content_type}", url]);
    const [code, type] = stdout.trim().split(" ");
    const body = await readFile(tmp);
    await route.fulfill({ status: Number(code) || 502, body, headers: { "content-type": type || "application/octet-stream", "access-control-allow-origin": "*" } });
  } catch {
    await route.abort();
  } finally {
    await rm(tmp, { force: true });
  }
}
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const log = [];

async function scene(name, { viewport, query = "", reducedMotion = "no-preference", steps }) {
  if (only && !name.startsWith(only)) return;
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion, hasTouch: viewport.width < 600, ignoreHTTPSErrors: true });
  await context.route((url) => url.protocol === "https:", viaCurl);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(base + query, { waitUntil: "load" });
  try {
    await page.waitForFunction(() => document.body.dataset.state && document.body.dataset.state !== "loading", null, { timeout: 20000 });
  } catch (e) {
    log.push({ scene: name, fatal: `never left loading: ${errors.join(" | ")}` });
    console.error(name, "never left loading", errors);
    await context.close();
    return;
  }
  await page.evaluate(() => document.fonts.ready);
  let i = 0;
  for (const step of steps) {
    if (step.key) await page.keyboard.press(step.key);
    if (step.click) await page.click(step.click);
    if (step.wheel) { await page.mouse.move(step.at?.[0] ?? 480, step.at?.[1] ?? 420); await page.mouse.wheel(0, step.wheel); }
    if (step.type) await page.keyboard.type(step.type, { delay: 40 });
    if (step.select) await page.selectOption(step.select[0], step.select[1]);
    if (step.freeze) await page.evaluate(() => window.__rack?.freeze());
    if (step.advance) { await page.evaluate((ms) => window.__rack?.step(ms), step.advance); await page.waitForTimeout(60); }
    if (step.until) {
      try { await page.waitForFunction((st) => document.body.dataset.state === st, step.until, { timeout: 15000 }); }
      catch { log.push({ scene: name, warning: `state ${step.until} not reached` }); }
    }
    if (step.snap) { await page.evaluate(() => window.__rack?.snap()); await page.waitForTimeout(700); }
    if (step.drag) {
      const { from, to, ms } = step.drag;
      await page.mouse.move(from[0], from[1]);
      await page.mouse.down();
      const n = 12;
      for (let k = 1; k <= n; k++) { await page.mouse.move(from[0] + ((to[0] - from[0]) * k) / n, from[1] + ((to[1] - from[1]) * k) / n); await page.waitForTimeout(ms / n); }
      await page.mouse.up();
    }
    if (step.probe) {
      const stats = await page.evaluate((ms) => new Promise((resolve) => {
        const deltas = []; let last = performance.now(); const end = last + ms;
        const f = (t) => { deltas.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else resolve({ frames: deltas.length, avg: deltas.reduce((a, b) => a + b, 0) / deltas.length, max: Math.max(...deltas) }); };
        requestAnimationFrame(f);
      }), step.probe);
      log.push({ scene: name, probe: stats });
    }
    if (step.wait) await page.waitForTimeout(step.wait);
    if (step.shot) {
      const file = path.join(outDir, `${name}-${String(++i).padStart(2, "0")}-${step.shot}.png`);
      await page.screenshot({ path: file });
      const state = await page.evaluate(() => ({ state: document.body.dataset.state, renderer: document.body.dataset.renderer, motion: document.body.dataset.motion, caption: document.querySelector("[data-title]")?.textContent, status: document.querySelector("[data-status]")?.textContent }));
      log.push({ scene: name, shot: step.shot, file: path.basename(file), ...state });
    }
  }
  if (errors.length) log.push({ scene: name, errors });
  await context.close();
}

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };

await scene("desktop-snapshot", { viewport: desktop, query: "?quality=low&review=1", steps: [
  { wait: 300, shot: "arrival" },
  { snap: true }, { until: "settled" }, { snap: true }, { shot: "settled" },
  { key: "ArrowLeft" }, { key: "ArrowLeft" }, { key: "ArrowLeft" }, { wait: 160, shot: "turning" },
  { snap: true }, { until: "settled" }, { snap: true }, { shot: "settled-after-keys" },
  { key: "Enter" }, { until: "open" }, { snap: true }, { shot: "open" },
  { wait: 2500, shot: "open-readme" },
  { key: "Escape" }, { until: "settled" }, { snap: true }, { shot: "closed" },
] });
await scene("desktop-shadows", { viewport: desktop, query: "?review=1", steps: [
  { snap: true }, { until: "settled" }, { snap: true }, { wait: 800, shot: "settled-high" },
  { key: "Enter" }, { until: "open" }, { snap: true }, { wait: 800, shot: "open-high" },
] });
await scene("desktop-stress60", { viewport: desktop, query: "?stress=60&quality=low&review=1", steps: [
  { snap: true }, { until: "settled" }, { snap: true }, { shot: "settled" },
  { wheel: -900 }, { probe: 1200 }, { wait: 100, shot: "wheel-turning" },
  { snap: true }, { until: "settled" }, { snap: true }, { shot: "wheel-settled" },
  { drag: { from: [300, 450], to: [620, 450], ms: 240 } }, { wait: 150, shot: "drag-release" },
  { snap: true }, { until: "settled" }, { snap: true }, { shot: "drag-settled" },
  { key: "Enter" }, { until: "open" }, { snap: true }, { shot: "open" },
  { key: "Escape" }, { until: "settled" }, { snap: true },
] });
await scene("desktop-filter", { viewport: desktop, query: "?stress=60&quality=low&review=1", steps: [
  { snap: true }, { until: "settled" }, { click: "[data-find]" }, { type: "atlas" }, { wait: 400 }, { snap: true }, { until: "settled" }, { snap: true }, { shot: "filtered" },
] });
// Motion sequences (no snapping): an open case turned away from, and a filter reflow.
// SwiftShader runs slowly, so the springs advance in capped steps; the frames show order, not speed.
await scene("sequence-close-on-turn", { viewport: desktop, query: "?quality=low&review=1", steps: [
  { snap: true }, { until: "settled" }, { snap: true }, { key: "Enter" }, { until: "open" }, { snap: true },
  { freeze: true }, { key: "ArrowLeft" },
  ...Array.from({ length: 12 }, (_, k) => ({ advance: 150, shot: `t${String((k + 1) * 150).padStart(4, "0")}ms` })),
] });
await scene("sequence-reflow", { viewport: desktop, query: "?stress=24&quality=low&review=1", steps: [
  { snap: true }, { until: "settled" }, { snap: true }, { freeze: true },
  { select: ["[data-order]", "name"] },
  ...Array.from({ length: 8 }, (_, k) => ({ advance: 100, shot: `t${String((k + 1) * 100).padStart(4, "0")}ms` })),
  { advance: 1200, shot: "t2000ms" },
] });
await scene("phone-stress60", { viewport: phone, query: "?stress=60&quality=low&review=1", steps: [
  { snap: true }, { until: "settled" }, { snap: true }, { shot: "settled" },
  { key: "Enter" }, { until: "open" }, { snap: true }, { shot: "open" },
] });
await scene("reduced-motion", { viewport: desktop, query: "?stress=60&quality=low", reducedMotion: "reduce", steps: [
  { wait: 1200, shot: "rest" },
  { key: "ArrowLeft" }, { wait: 600, shot: "after-key" },
  { key: "Enter" }, { wait: 1200, shot: "open" },
] });
await scene("flat-renderer", { viewport: desktop, query: "?stress=60&renderer=flat", steps: [
  { wait: 1200, shot: "rest" },
  { key: "Enter" }, { wait: 1200, shot: "open" },
] });

if (only === "wedge") {
  // Look-development wedges: one variable per row, the extracted case at rest, full quality.
  for (const coat of [0.1, 0.25, 0.5]) {
    await scene(`wedge-coat-${coat}`, { viewport: { width: 960, height: 780 }, query: `?review=1&coat=${coat}`, steps: [
      { snap: true }, { until: "settled" }, { snap: true }, { wait: 900, shot: "rest" },
    ] });
  }
  for (const key of [1.8, 2.4, 3.0]) {
    await scene(`wedge-key-${key}`, { viewport: { width: 960, height: 780 }, query: `?review=1&key=${key}`, steps: [
      { snap: true }, { until: "settled" }, { snap: true }, { wait: 900, shot: "rest" },
    ] });
  }
}

await writeFile(path.join(outDir, "review-log.json"), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
await browser.close();
server.close();
