import { type Entry, GREY, INK, PAPER } from "./catalogue";

/**
 * The printed matter, plain (recipe/baseline.md): front insert, spine, inside sheet and disc,
 * drawn to canvas in black and grey on white, in the system sans at one weight. Nothing here is
 * decoration; each sheet carries the project's name and its facts. Everything is a deterministic
 * function of the entry.
 */

export const INSERT_ASPECT = 190 / 135;
export const SPINE_ASPECT = 190 / 15;

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const TRAY = "#F2F2F2";
const DISC = "#DCDCDC";
const EDGE = "#E4E4E4";

function font(size: number): string {
  return `400 ${size.toFixed(1)}px ${SANS}`;
}

/** System faces need no loading; kept so callers can await type before drawing. */
export function ensureFonts(): Promise<void> {
  return Promise.resolve();
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  // An alpha canvas gets greyscale antialiasing; an opaque one gets subpixel text with colour fringes.
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return [c, ctx];
}

/** Greedy word wrap to `maxW`, at most `maxLines`; the last line ends in an ellipsis if cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxW || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines) {
      line = "";
      break;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  const used = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (used < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

/** One line, shrunk to fit `maxW` down to `minSize`, then truncated. */
function fitLine(ctx: CanvasRenderingContext2D, text: string, size: number, minSize: number, maxW: number): [string, number] {
  ctx.font = font(size);
  const width = ctx.measureText(text).width;
  if (width <= maxW) return [text, size];
  const s = Math.max(minSize, size * (maxW / width));
  ctx.font = font(s);
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -1);
  return [t === text ? t : `${t.trimEnd()}…`, s];
}

/** The project title, wrapped from the top-left of a box; returns the y below it. */
function title(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, maxLines: number): number {
  ctx.font = font(size);
  // A single word wider than the box shrinks instead of breaking.
  const longest = Math.max(...text.split(/\s+/).map((w) => ctx.measureText(w).width));
  if (longest > maxW) {
    size *= maxW / longest;
    ctx.font = font(size);
  }
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  const lead = size * 1.15;
  let at = y + size;
  for (const line of wrap(ctx, text, maxW, maxLines)) {
    ctx.fillText(line, x, at);
    at += lead;
  }
  return at - lead + size * 0.3;
}

function details(entry: Entry): string {
  return [entry.language ?? "No language", entry.born].join(", ");
}

/** Front insert: the title at the top left, the author and facts at the foot. */
export function drawInsert(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * INSERT_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  const m = w * 0.08;
  title(ctx, entry.title, m, m, w - 2 * m, w * 0.09, 4);
  const small = w * 0.04;
  ctx.font = font(small);
  ctx.fillStyle = INK;
  ctx.fillText("Ethan Lee Barrett", m, h - m - small * 1.35);
  ctx.fillStyle = GREY;
  ctx.fillText(details(entry), m, h - m);
  return canvas;
}

/** Spine: the title runs top to bottom, the language code sits at the foot. */
export function drawSpine(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * SPINE_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w, 0);
  ctx.rotate(Math.PI / 2);
  // Now x runs down the spine (0..h) and y across it (0..w).
  ctx.textBaseline = "middle";
  const mid = w * 0.52;
  const pad = w * 0.6;
  ctx.font = font(w * 0.3);
  ctx.fillStyle = GREY;
  const code = entry.code === "—" ? "" : entry.code;
  const codeWidth = ctx.measureText(code).width;
  ctx.fillText(code, h - pad - codeWidth, mid);
  const [text, size] = fitLine(ctx, entry.title, w * 0.42, w * 0.32, h - pad * 2 - codeWidth - w);
  ctx.font = font(size);
  ctx.fillStyle = INK;
  ctx.fillText(text, pad, mid);
  ctx.restore();
  return canvas;
}

/** Inside left: the liner sheet with the description. */
export function drawInsideLeft(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * INSERT_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  const m = w * 0.1;
  let y = title(ctx, entry.title, m, m, w - 2 * m, w * 0.07, 3);
  const size = w * 0.045;
  ctx.font = font(size);
  ctx.fillStyle = INK;
  const desc = entry.description?.trim() || "No description on GitHub yet.";
  y += size * 1.6;
  for (const line of wrap(ctx, desc, w - 2 * m, 9)) {
    ctx.fillText(line, m, y);
    y += size * 1.45;
  }
  ctx.font = font(w * 0.036);
  ctx.fillStyle = GREY;
  ctx.fillText(`Ethan Lee Barrett, ${entry.born}`, m, h - m);
  return canvas;
}

/** Inside right: a pale tray holding a plain grey disc with the name on it. */
export function drawInsideRight(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * INSERT_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = TRAY;
  ctx.fillRect(0, 0, w, h);
  const cx = w * 0.5;
  const cy = h * 0.47;
  const R = w * 0.41;
  ctx.fillStyle = DISC;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TRAY;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const [text, size] = fitLine(ctx, entry.title, w * 0.045, w * 0.03, R * 1.3);
  ctx.font = font(size);
  ctx.fillStyle = INK;
  ctx.fillText(text, cx, cy - R * 0.32);
  ctx.font = font(w * 0.03);
  ctx.fillText(details(entry), cx, cy + R * 0.42);
  ctx.textAlign = "left";
  return canvas;
}

/** Colour of the case's sides and of an unprinted face. */
export function edgeColour(): string {
  return EDGE;
}
