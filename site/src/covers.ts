import type { Entry } from "./catalogue";
import { paintLogo } from "./logo";
import { hashSeed } from "./random";
import { SCENES, type Scene, paperGrain, photograph } from "./xerox";

/**
 * The printed matter (recipe/direction-v3.md, covers), as a demo tape would have it:
 *   front   a photocopied night photograph, the logo in white across the top, the facts at the
 *           foot in small Helvetica; one case in five is the logo alone on black
 *   spine   black, the logo running down it, the language code at the foot
 *   inside  left, a white photocopied sheet: the logo in black, the name, the description;
 *           right, a black tray holding a black disc with the logo printed on it
 * Everything is a deterministic function of the entry.
 */

export const INSERT_ASPECT = 190 / 135;
export const SPINE_ASPECT = 190 / 15;

const SANS = '"Helvetica Neue", Helvetica, "Nimbus Sans", FreeSans, Arial, sans-serif';
const BLACK = "#000";
const WHITE = "#fff";
const EDGE = "#0c0c0c";

function font(size: number, weight = 400): string {
  return `${weight} ${size.toFixed(1)}px ${SANS}`;
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

type Layout = Scene | "void";

/** One case in five is the logo alone; the rest carry a photograph. */
export function layoutOf(entry: Entry): Layout {
  const h = hashSeed(`cover:${entry.name}`);
  return h % 5 === 0 ? "void" : SCENES[(h >>> 3) % SCENES.length];
}

/** Greedy word wrap to `maxW`, at most `maxLines`; the last line ends in an ellipsis if cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let used = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxW || !line) {
      line = next;
      used++;
      continue;
    }
    lines.push(line);
    if (lines.length === maxLines) {
      line = "";
      break;
    }
    line = word;
    used++;
  }
  if (line) lines.push(line);
  if (used < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function details(entry: Entry): string {
  return [entry.language ?? "No language", entry.born].join(" ");
}

/** Front insert. `w` sets resolution; the layout is proportional. */
export function drawInsert(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * INSERT_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, w, h);
  const layout = layoutOf(entry);
  const dpr = w / 540;
  if (layout === "void") {
    paintLogo(ctx, entry.title, w * 0.07, h * 0.28, w * 0.86, h * 0.34, WHITE);
  } else {
    ctx.drawImage(photograph(entry.name, layout, w, h), 0, 0);
    // The top falls to black so the logo reads over the sky; the foot does the same for the facts.
    const top = ctx.createLinearGradient(0, 0, 0, h * 0.42);
    top.addColorStop(0, "rgba(0,0,0,0.92)");
    top.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h * 0.42);
    const foot = ctx.createLinearGradient(0, h * 0.84, 0, h);
    foot.addColorStop(0, "rgba(0,0,0,0)");
    foot.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = foot;
    ctx.fillRect(0, h * 0.84, w, h * 0.16);
    paintLogo(ctx, entry.title, w * 0.06, h * 0.035, w * 0.88, h * 0.27, WHITE);
  }
  const m = w * 0.065;
  ctx.font = font(13 * dpr);
  ctx.fillStyle = WHITE;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Ethan Lee Barrett", m, h - m);
  ctx.textAlign = "right";
  ctx.fillText(details(entry), w - m, h - m);
  ctx.textAlign = "left";
  return canvas;
}

/** Spine: black, the logo running top to bottom, the language code at the foot. */
export function drawSpine(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * SPINE_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w, 0);
  ctx.rotate(Math.PI / 2);
  // Now x runs down the spine (0..h) and y across it (0..w).
  const pad = w * 0.5;
  ctx.font = font(w * 0.28, 700);
  ctx.fillStyle = WHITE;
  ctx.textBaseline = "middle";
  const code = entry.code === "—" ? "" : entry.code;
  const codeW = ctx.measureText(code).width;
  ctx.fillText(code, h - pad - codeW, w * 0.52);
  // The logo takes the spine's whole width; long logos shrink along it.
  paintLogo(ctx, entry.title, pad, w * 0.06, h - pad * 2 - codeW - w * 0.8, w * 0.88, WHITE);
  ctx.restore();
  return canvas;
}

/** Inside left: the photocopied sheet. */
export function drawInsideLeft(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * INSERT_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, w, h);
  const dpr = w / 540;
  const m = w * 0.09;
  paintLogo(ctx, entry.title, m, h * 0.05, w - 2 * m, h * 0.2, BLACK);
  let y = h * 0.32;
  ctx.fillStyle = BLACK;
  ctx.textBaseline = "alphabetic";
  ctx.font = font(26 * dpr, 700);
  for (const line of wrap(ctx, entry.title, w - 2 * m, 2)) {
    ctx.fillText(line, m, y);
    y += 30 * dpr;
  }
  y += 14 * dpr;
  ctx.font = font(19 * dpr);
  const desc = entry.description?.trim() || "No description on GitHub yet.";
  for (const line of wrap(ctx, desc, w - 2 * m, 9)) {
    ctx.fillText(line, m, y);
    y += 26 * dpr;
  }
  ctx.font = font(14 * dpr);
  ctx.fillText(`Ethan Lee Barrett, ${entry.born}`, m, h - m);
  ctx.textAlign = "right";
  ctx.fillText(entry.language ?? "No language", w - m, h - m);
  ctx.textAlign = "left";
  paperGrain(ctx, w, h, entry.name);
  return canvas;
}

/** Inside right: the tray and the disc, black, with the logo printed on the disc. */
export function drawInsideRight(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * INSERT_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, w, h);
  const cx = w * 0.5;
  const cy = h * 0.47;
  const R = w * 0.41;
  ctx.fillStyle = "#141414";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = Math.max(1, w * 0.003);
  for (const k of [0.98, 0.36, 0.3]) {
    ctx.beginPath();
    ctx.arc(cx, cy, R * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  paintLogo(ctx, entry.title, cx - R * 0.78, cy - R * 0.86, R * 1.56, R * 0.6, WHITE);
  ctx.fillStyle = "#050505";
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.1, 0, Math.PI * 2);
  ctx.fill();
  const dpr = w / 540;
  ctx.font = font(13 * dpr);
  ctx.fillStyle = WHITE;
  ctx.textAlign = "center";
  ctx.fillText(details(entry), cx, cy + R * 0.62);
  ctx.textAlign = "left";
  return canvas;
}

/** Colour of the case's sides: black plastic. */
export function edgeColour(): string {
  return EDGE;
}
