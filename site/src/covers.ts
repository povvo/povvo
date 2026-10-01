import { type Entry, type Shell, INK, PAPER, FIELD, SIGNAL, shellOf } from "./catalogue";
import { drawQuilt, drawTile, drawTileCube, hashSeed, randomTile, rng, subPalette } from "./tiles";

/**
 * The printed matter: front insert, spine, inside sheet and disc, drawn to canvas.
 * Cover system (recipe/direction-v2.md): four layouts in one language.
 *   quilt     a patchwork of geometric tiles over a bounded title block in the shell
 *   block     packaging collage: a heat-field "photograph", a checker block, a volume numeral
 *   horizon   a pale heat field with one tiny hot object on the horizon (drift), a tile rail
 *   specimen  bone and ink: a contained halftone, one red event dot, a drawn callout
 * Everything is a deterministic function of the entry, so a cover never changes between visits.
 */

export const INSERT_ASPECT = 190 / 135;
export const SPINE_ASPECT = 190 / 15;

const DISPLAY = '"Heat Display"';
const MONO = '"Heat Mono"';
const NARROW = '"Heat Mono Narrow"';
const SERIF = '"Heat Serif"';

let fontsReady: Promise<void> | null = null;
export function ensureFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = Promise.all([
      document.fonts.load(`900 40px ${DISPLAY}`),
      document.fonts.load(`500 20px ${MONO}`),
      document.fonts.load(`400 20px ${NARROW}`),
      document.fonts.load(`400 20px ${SERIF}`),
    ]).then(() => undefined);
  }
  return fontsReady;
}

export function shellHex(entry: Entry): string {
  return shellOf(entry).hex;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function darken(hex: string, amount: number): string {
  const f = 1 - amount;
  return `#${rgb(hex).map((v) => Math.round(v * f).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const c = rgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Ink or paper, whichever reads better on `hex`. */
export function textOn(hex: string): string {
  const l = luminance(hex);
  const onInk = (l + 0.05) / (luminance(INK) + 0.05);
  const onPaper = (luminance(PAPER) + 0.05) / (l + 0.05);
  return onInk >= onPaper ? INK : PAPER;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  const ctx = c.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2D canvas unavailable");
  return [c, ctx];
}

// ---------- type ----------

export interface Fit {
  lines: string[];
  size: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** The same fitting the covers use, for the giant title in the page (same face, same metrics). */
export function fitTitle(text: string, maxW: number, maxH: number, maxLines: number, lineHeight: number, maxSize = Infinity): Fit {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d")!;
  return fitDisplay(measureCtx, text, maxW, maxH, maxLines, lineHeight, maxSize);
}

/**
 * Largest size at which `text` fits the box, trying one to `maxLines` balanced lines.
 * Breaks only between words; a single long word shrinks instead of breaking.
 */
function fitDisplay(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, maxLines: number, lineHeight: number, maxSize = Infinity): Fit {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  ctx.font = `900 100px ${DISPLAY}`;
  ctx.letterSpacing = "0px";
  const widths = words.map((w) => ctx.measureText(w).width);
  const space = ctx.measureText(" ").width;
  let best: Fit = { lines: [words.join(" ")], size: 1 };
  const n = words.length;
  for (let k = 1; k <= Math.min(maxLines, n); k++) {
    // Choose k-1 break points that minimise the widest line.
    let bestBreaks: number[] = [];
    let bestWidest = Infinity;
    const breaks: number[] = [];
    const walk = (start: number, left: number): void => {
      if (left === 0) {
        const cuts = [0, ...breaks, n];
        let widest = 0;
        for (let i = 0; i < cuts.length - 1; i++) {
          let lw = 0;
          for (let j = cuts[i]; j < cuts[i + 1]; j++) lw += widths[j] + (j > cuts[i] ? space : 0);
          widest = Math.max(widest, lw);
        }
        if (widest < bestWidest) {
          bestWidest = widest;
          bestBreaks = breaks.slice();
        }
        return;
      }
      for (let b = start; b <= n - left; b++) {
        breaks.push(b);
        walk(b + 1, left - 1);
        breaks.pop();
      }
    };
    walk(1, k - 1);
    const size = Math.min(maxSize, (maxW / bestWidest) * 100, maxH / (k * lineHeight));
    if (size > best.size * 1.06) {
      const cuts = [0, ...bestBreaks, n];
      const lines: string[] = [];
      for (let i = 0; i < cuts.length - 1; i++) lines.push(words.slice(cuts[i], cuts[i + 1]).join(" "));
      best = { lines, size };
    }
  }
  return best;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.replace(/[\s,.;:]+$/, "")}…`;
  }
  return lines;
}

function mono(ctx: CanvasRenderingContext2D, size: number, weight = 500, narrow = false): void {
  ctx.font = `${weight} ${size}px ${narrow ? NARROW : MONO}`;
  ctx.letterSpacing = `${size * 0.04}px`;
}

// ---------- motifs ----------

function capsule(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, colour: string, align: "left" | "right" = "left"): number {
  mono(ctx, size, 500);
  const tw = ctx.measureText(text).width;
  const padX = size * 0.75;
  const bw = tw + padX * 2;
  const bh = size * 1.9;
  const left = align === "left" ? x : x - bw;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1, size * 0.09);
  ctx.beginPath();
  ctx.roundRect(left, y, bw, bh, bh / 2);
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + padX, y + bh / 2 + size * 0.04);
  ctx.restore();
  return bw;
}

let grainTile: HTMLCanvasElement | null = null;
/** Static print grain: one small tile, multiplied at low strength. Never on reading text. */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number): void {
  if (!grainTile) {
    grainTile = document.createElement("canvas");
    grainTile.width = grainTile.height = 96;
    const g = grainTile.getContext("2d")!;
    const img = g.createImageData(96, 96);
    let seed = 7;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      const v = 150 + (seed % 106);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = ctx.createPattern(grainTile, "repeat")!;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function setTitle(ctx: CanvasRenderingContext2D, fit: Fit, x: number, top: number, lineHeight: number, colour: string, align: CanvasTextAlign = "left"): number {
  ctx.font = `900 ${fit.size}px ${DISPLAY}`;
  ctx.letterSpacing = `${-fit.size * 0.005}px`;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  let y = top + fit.size * 0.86;
  for (const line of fit.lines) {
    ctx.fillText(line, x, y);
    y += fit.size * lineHeight;
  }
  ctx.textAlign = "left";
  return y - fit.size * lineHeight + fit.size * 0.14;
}

// ---------- layouts ----------

function palette(e: Entry, s: Shell, size: number, salt = ""): string[] {
  return subPalette(rng(hashSeed(e.name + salt)), size, s.hex);
}

/** The volume numeral: the accession number, the order in which the work was started. */
function volume(e: Entry): string {
  return String(e.no);
}

function quilt(ctx: CanvasRenderingContext2D, e: Entry, s: Shell, w: number, h: number): void {
  const m = w * 0.07;
  const r = rng(hashSeed(e.name));
  const split = h * 0.64;
  drawQuilt(ctx, r, 0, 0, w, split, { cols: 3, rows: 3, palette: palette(e, s, 6), diamonds: 1, numeral: volume(e) });
  // The bounded title block: the shell, hard against the patchwork.
  ctx.fillStyle = s.hex;
  ctx.fillRect(0, split, w, h - split);
  const fit = fitDisplay(ctx, e.title, w - m * 2, h * 0.19, 3, 0.86);
  setTitle(ctx, fit, m, split + h * 0.035, 0.86, s.text);
  capsule(ctx, e.capsule, m, h - m - h * 0.04, w * 0.03, s.text);
  mono(ctx, w * 0.026, 400, true);
  ctx.fillStyle = s.text;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("ETHAN LEE BARRETT", w - m, h - m - h * 0.04 + w * 0.03 * 0.95);
  ctx.textAlign = "left";
  grain(ctx, w, h, 0.07);
}

/** A small heat-field "photograph": sky, horizon, sand, one hot object and its long shadow. */
function heatScene(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, object: string, marker: string, line = 0.62): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, FIELD.sky);
  g.addColorStop(line - 0.02, FIELD.paper);
  g.addColorStop(line, FIELD.sand);
  g.addColorStop(1, FIELD.dust);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const hy = y + h * line;
  ctx.fillStyle = "rgba(17,23,25,.28)";
  ctx.fillRect(x, hy, w, Math.max(1, w * 0.004));
  const ox = x + w * 0.64;
  const ow = w * 0.11;
  const oh = w * 0.17;
  ctx.fillStyle = "rgba(17,23,25,.16)";
  ctx.beginPath();
  ctx.moveTo(ox, hy);
  ctx.lineTo(ox + ow, hy);
  ctx.lineTo(ox - w * 0.42, hy + h * 0.12);
  ctx.lineTo(ox - w * 0.5, hy + h * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = object;
  ctx.fillRect(ox, hy - oh, ow, oh);
  ctx.fillStyle = marker;
  ctx.fillRect(ox + ow * 0.6, hy - oh - w * 0.045, w * 0.032, w * 0.032);
  ctx.restore();
}

function block(ctx: CanvasRenderingContext2D, e: Entry, s: Shell, w: number, h: number): void {
  const m = w * 0.07;
  const pal = palette(e, s, 5, "block");
  const band = h * 0.14;
  const mid = h * 0.62;
  const split = w * 0.56;
  // Top band: the accent, with the code and the volume.
  const accentText = textOn(s.accent);
  ctx.fillStyle = s.accent;
  ctx.fillRect(0, 0, w, band);
  capsule(ctx, e.capsule, m, band / 2 - w * 0.03 * 0.95, w * 0.03, accentText);
  mono(ctx, w * 0.03, 500);
  ctx.fillStyle = accentText;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(`VOL. ${volume(e).padStart(2, "0")}`, w - m, band / 2);
  ctx.textAlign = "left";
  // The "photograph".
  heatScene(ctx, 0, band, split, mid - band, s.hex, pal[1] ?? SIGNAL);
  // Checker block and numeral block.
  const cw = w - split;
  const checkH = (mid - band) * 0.42;
  const c1 = pal[2] ?? "#F59AC7";
  const c2 = pal[3] ?? "#2E5B2D";
  const n = 3;
  const cell = cw / n;
  for (let j = 0; j * cell < checkH; j++) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = (i + j) % 2 ? c2 : c1;
      ctx.fillRect(split + i * cell, band + j * cell, cell + 0.5, Math.min(cell, checkH - j * cell) + 0.5);
    }
  }
  const numTop = band + checkH;
  const numBg = pal[4] ?? "#EFE61B";
  ctx.fillStyle = numBg;
  ctx.fillRect(split, numTop, cw, mid - numTop);
  ctx.fillStyle = textOn(numBg) === INK ? c2 === numBg ? INK : darkest([c1, c2, INK]) : PAPER;
  ctx.font = `900 ${(mid - numTop) * 0.92}px ${DISPLAY}`;
  ctx.letterSpacing = "0px";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(volume(e), split + cw / 2, mid - (mid - numTop) * 0.1);
  ctx.textAlign = "left";
  // Title on the shell.
  ctx.fillStyle = s.hex;
  ctx.fillRect(0, mid, w, h - mid);
  const fit = fitDisplay(ctx, e.title, w - m * 2, h * 0.22, 3, 0.86);
  setTitle(ctx, fit, m, mid + h * 0.04, 0.86, s.text);
  mono(ctx, w * 0.026, 400, true);
  ctx.fillStyle = s.text;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`ETHAN LEE BARRETT — ${(e.language ?? "No language").toUpperCase()} — ${e.born}`, m, h - m * 0.9);
  grain(ctx, w, h, 0.07);
}

function darkest(colours: string[]): string {
  return colours.reduce((a, b) => (luminance(b) < luminance(a) ? b : a));
}

function horizon(ctx: CanvasRenderingContext2D, e: Entry, s: Shell, w: number, h: number): void {
  const m = w * 0.07;
  const line = h * 0.63;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, FIELD.sky);
  sky.addColorStop(0.6, FIELD.paper);
  sky.addColorStop(0.63, FIELD.sand);
  sky.addColorStop(1, FIELD.dust);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(17,23,25,.28)";
  ctx.fillRect(0, line, w, Math.max(1, w * 0.003));
  // The tiny hot object that activates the field, with a long heat shadow.
  const ox = w * 0.66;
  const ow = w * 0.075;
  const oh = w * 0.12;
  ctx.save();
  ctx.fillStyle = "rgba(17,23,25,.16)";
  ctx.beginPath();
  ctx.moveTo(ox, line);
  ctx.lineTo(ox + ow, line);
  ctx.lineTo(ox - w * 0.28, line + h * 0.07);
  ctx.lineTo(ox - w * 0.33, line + h * 0.07);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = s.hex;
  ctx.fillRect(ox, line - oh, ow, oh);
  ctx.fillStyle = s.accent;
  ctx.fillRect(ox + ow * 0.62, line - oh - w * 0.03, w * 0.022, w * 0.022);
  // Edge rail of numerals, cropped at the right margin.
  mono(ctx, w * 0.024, 400, true);
  ctx.fillStyle = "rgba(17,23,25,.55)";
  ctx.textAlign = "right";
  for (let i = 0; i < 10; i++) ctx.fillText(String(i).padStart(2, "0"), w - w * 0.025, h * 0.1 + i * h * 0.04);
  ctx.textAlign = "left";
  const fit = fitDisplay(ctx, e.title, w * 0.78, h * 0.34, 3, 0.86);
  setTitle(ctx, fit, m, h * 0.07, 0.86, INK);
  // Provenance on the sand.
  capsule(ctx, e.capsule, m, h * 0.72, w * 0.03, INK);
  mono(ctx, w * 0.028, 400, true);
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`ETHAN LEE BARRETT — ${(e.language ?? "No language").toUpperCase()} — ${e.born}`, m, h * 0.83);
  // A tile rail ties the cover to the case: the shell first, then the patchwork.
  const r = rng(hashSeed(e.name + "rail"));
  const pal = palette(e, s, 5, "rail");
  const size = w / 8;
  let prev: string | undefined;
  for (let i = 0; i < 8; i++) {
    const t = i === 0 ? { kind: "solid" as const, a: s.hex, b: s.hex, turn: 0, n: 1 } : randomTile(r, pal, prev);
    if (t.kind === "numeral") t.kind = "checker";
    drawTile(ctx, t, i * size, h - size, size);
    prev = t.a;
  }
  grain(ctx, w, h, 0.06);
}

function specimen(ctx: CanvasRenderingContext2D, e: Entry, s: Shell, w: number, h: number, accent: string): void {
  const m = w * 0.06;
  ctx.fillStyle = s.hex;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, w * 0.003);
  ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
  // Header row.
  mono(ctx, w * 0.028, 500);
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("SPECIMEN", m + w * 0.04, m + h * 0.045);
  ctx.textAlign = "right";
  ctx.fillText(e.capsule, w - m - w * 0.04, m + h * 0.045);
  ctx.textAlign = "left";
  ctx.fillRect(m, m + h * 0.065, w - 2 * m, Math.max(1, w * 0.003));
  // Contained halftone: a lit sphere in dots, clipped to its disc.
  const cx = w * 0.5;
  const cy = h * 0.42;
  const R = w * 0.3;
  const step = w * 0.024;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = INK;
  for (let y = cy - R; y <= cy + R; y += step) {
    for (let x = cx - R; x <= cx + R; x += step) {
      const nx = (x - cx) / R;
      const ny = (y - cy) / R;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const nz = Math.sqrt(1 - d);
      const lit = Math.max(0, -0.5 * nx - 0.6 * ny + 0.62 * nz);
      const r = step * 0.5 * Math.min(1, Math.max(0.08, 1 - lit));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  // One event dot and its drawn callout.
  const dx = cx + R * 0.62;
  const dy = cy - R * 0.7;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(dx, dy, w * 0.026, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, w * 0.0028);
  ctx.beginPath();
  ctx.arc(dx, dy, w * 0.055, 0, Math.PI * 2);
  ctx.moveTo(dx + w * 0.055, dy);
  ctx.lineTo(w - m - w * 0.02, dy);
  ctx.stroke();
  mono(ctx, w * 0.024, 400, true);
  ctx.fillStyle = INK;
  ctx.textAlign = "right";
  ctx.fillText(`FIG. ${e.code === "—" ? "MD" : e.code}`, w - m - w * 0.03, dy - w * 0.02);
  ctx.textAlign = "left";
  const fit = fitDisplay(ctx, e.title, w - 2 * m - w * 0.08, h * 0.17, 3, 0.86);
  const bottom = h - m - h * 0.08;
  setTitle(ctx, fit, m + w * 0.04, bottom - fit.lines.length * fit.size * 0.86, 0.86, INK);
  mono(ctx, w * 0.026, 400, true);
  ctx.fillStyle = INK;
  ctx.fillText(`ETHAN LEE BARRETT — ${(e.language ?? "No language").toUpperCase()} — ${e.born}`, m + w * 0.04, h - m - h * 0.035);
  grain(ctx, w, h, 0.05);
}

/** Front insert. `w` sets resolution; the layout is proportional. */
export function drawInsert(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * INSERT_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  const s = shellOf(entry);
  switch (entry.layout) {
    case "quilt":
      quilt(ctx, entry, s, w, h);
      break;
    case "block":
      block(ctx, entry, s, w, h);
      break;
    case "horizon":
      horizon(ctx, entry, s, w, h);
      break;
    default:
      specimen(ctx, entry, s, w, h, SIGNAL);
  }
  return canvas;
}

/** Spine: text runs top to bottom; a checker block at the head, the capsule code at the foot. */
export function drawSpine(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * SPINE_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  const s = shellOf(entry);
  ctx.fillStyle = s.hex;
  ctx.fillRect(0, 0, w, h);
  const cell = w / 2;
  const hr = rng(hashSeed(entry.name + "spine"));
  const hp = palette(entry, s, 4, "spine");
  const head = randomTile(hr, hp, s.hex);
  if (head.kind === "numeral" || head.kind === "solid") head.kind = "checker";
  drawTile(ctx, head, 0, 0, w);
  ctx.save();
  ctx.translate(w, 0);
  ctx.rotate(Math.PI / 2);
  // Now x runs down the spine (0..h) and y across it (0..w).
  ctx.fillStyle = s.text;
  ctx.textBaseline = "middle";
  const mid = w * 0.53;
  const pad = cell * 2 + w * 0.4;
  mono(ctx, w * 0.27, 500);
  const code = entry.capsule;
  const codeWidth = ctx.measureText(code).width;
  ctx.fillText(code, h - w * 0.35 - codeWidth, mid);
  ctx.fillStyle = s.accent === SIGNAL ? SIGNAL : s.accent;
  ctx.fillRect(h - w * 0.35 - codeWidth - w * 0.62, w * 0.36, w * 0.28, w * 0.28);
  ctx.fillStyle = s.text;
  let size = w * 0.66;
  ctx.font = `900 ${size}px ${DISPLAY}`;
  ctx.letterSpacing = "0px";
  const avail = h - pad - codeWidth - w * 1.4;
  let title = entry.title.toUpperCase();
  const width = ctx.measureText(title).width;
  if (width > avail) {
    // Shrink to a floor, then truncate.
    size = Math.max(w * 0.5, size * (avail / width));
    ctx.font = `900 ${size}px ${DISPLAY}`;
    while (title.length > 2 && ctx.measureText(`${title}…`).width > avail) title = title.slice(0, -1);
    if (title !== entry.title.toUpperCase()) title = `${title.trimEnd()}…`;
  }
  ctx.fillText(title, pad, mid + size * 0.04);
  ctx.restore();
  grain(ctx, w, h, 0.06);
  return canvas;
}

/** Inside left: the liner sheet with the printed description. */
export function drawInsideLeft(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * INSERT_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  const s = shellOf(entry);
  ctx.fillStyle = FIELD.bone;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = FIELD.sand;
  ctx.fillRect(0, h * 0.66, w, h * 0.34);
  const left = w * 0.1;
  const right = w * 0.9;
  capsule(ctx, entry.capsule, left, h * 0.06, w * 0.032, INK);
  mono(ctx, w * 0.03, 500);
  ctx.fillStyle = INK;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("LINER NOTES", right, h * 0.06 + w * 0.032 * 0.95);
  ctx.textAlign = "left";
  const fit = fitDisplay(ctx, entry.title, right - left, h * 0.2, 3, 0.86);
  let y = setTitle(ctx, fit, left, h * 0.13, 0.86, INK);
  ctx.font = `400 ${w * 0.05}px ${SERIF}`;
  ctx.letterSpacing = "0px";
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  const desc = entry.description?.trim() || "No description on GitHub yet. The booklet holds the README.";
  y += h * 0.06;
  for (const line of wrap(ctx, desc, right - left, 5)) {
    ctx.fillText(line, left, y);
    y += w * 0.066;
  }
  ctx.fillStyle = s.hex;
  ctx.fillRect(left, h * 0.71, w * 0.06, w * 0.06);
  mono(ctx, w * 0.027, 400, true);
  ctx.fillStyle = INK;
  ctx.fillText("THE README IS IN THE BOOKLET →", left + w * 0.09, h * 0.71 + w * 0.045);
  ctx.fillText(`ETHAN LEE BARRETT — ${entry.born}`, left, h * 0.92);
  grain(ctx, w, h, 0.05);
  return canvas;
}

/** Inside right: the tray and the disc, black with a patterned isometric label. */
export function drawInsideRight(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * INSERT_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  const s = shellOf(entry);
  ctx.fillStyle = darken(s.hex, 0.28);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = darken(s.hex, 0.42);
  ctx.fillRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88);
  const cx = w * 0.5;
  const cy = h * 0.47;
  const R = w * 0.41;
  ctx.fillStyle = "#0c0d0e";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  // Grooves, and one band of sheen from the sun.
  ctx.strokeStyle = "rgba(255,255,255,.05)";
  ctx.lineWidth = Math.max(1, w * 0.0018);
  for (let r = R * 0.42; r < R * 0.97; r += R * 0.022) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const sheen = ctx.createConicGradient(-0.9, cx, cy);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.06, "rgba(255,255,255,.16)");
  sheen.addColorStop(0.12, "rgba(255,255,255,0)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0)");
  sheen.addColorStop(0.56, "rgba(255,255,255,.1)");
  sheen.addColorStop(0.62, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.97, 0, Math.PI * 2);
  ctx.arc(cx, cy, R * 0.4, 0, Math.PI * 2, true);
  ctx.fill();
  // The label: an isometric solid faced with the case's patchwork.
  drawTileCube(ctx, rng(hashSeed(entry.name + "label")), cx, cy, R * 0.33, palette(entry, s, 6, "label"));
  ctx.fillStyle = FIELD.bone;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.035, 0, Math.PI * 2);
  ctx.fill();
  // Matrix text under the disc.
  mono(ctx, w * 0.028, 500);
  ctx.fillStyle = textOn(darken(s.hex, 0.42));
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${entry.capsule} — VOL. ${volume(entry).padStart(2, "0")}`, cx, h * 0.91);
  ctx.textAlign = "left";
  return canvas;
}

/** The spread slab's patchwork, as an image for the page (same seed as the cover). */
export function drawSlab(entry: Entry, w: number, h: number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(w, h);
  const s = shellOf(entry);
  const cols = Math.max(4, Math.round(w / (h / 2.2)));
  drawQuilt(ctx, rng(hashSeed(entry.name + "slab")), 0, 0, w, h, { cols, rows: 3, palette: palette(entry, s, 7, "slab"), diamonds: 2, numeral: volume(entry) });
  grain(ctx, w, h, 0.06);
  return canvas;
}

/** Edge colour for the sleeve sides. */
export function edgeColour(entry: Entry): string {
  return darken(shellOf(entry).hex, 0.16);
}
