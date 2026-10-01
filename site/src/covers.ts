import { type Entry, INKS, STOCK, formatNo } from "./catalogue";

/**
 * The printed matter: front insert, spine, inside sheet and disc, drawn to canvas.
 * Shape grammar and roles are in recipe/visual-system.md. Everything is typographic;
 * the only drawn graphic is the position mark (a ring with a dot at the case's angle).
 */

export const INSERT_ASPECT = 190 / 135;
export const SPINE_ASPECT = 190 / 15;

const STOCK_RAISED = "#F2EFE9";
const STOCK_DEEP = "#DCD7CE";

let fontsReady: Promise<void> | null = null;
export function ensureFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = Promise.all([
      document.fonts.load('400 40px "Fraunces Cover"'),
      document.fonts.load('400 16px "Fraunces Text"'),
      document.fonts.load('600 20px "Archivo Spine"'),
      document.fonts.load('400 20px "Archivo Spine"'),
      document.fonts.load('500 20px "Archivo Label"'),
    ]).then(() => undefined);
  }
  return fontsReady;
}

export function inkOf(entry: Entry): string {
  return INKS[entry.ink].hex;
}

export function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `rgb(${r} ${g} ${b})`;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  const ctx = c.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2D canvas unavailable");
  return [c, ctx];
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
      // A single word wider than the measure is broken by character.
      while (ctx.measureText(line).width > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
        if (lines.length >= maxLines) return lines.slice(0, maxLines);
      }
    } else {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  return lines;
}

function positionMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, angle: number, stroke: number, colour: string): void {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = stroke;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function markAngle(entry: Entry, total: number): number {
  return -Math.PI / 2 + (Math.PI * 2 * (entry.no - 1)) / Math.max(1, total);
}

/** Front insert. `w` sets resolution; the layout is proportional. */
export function drawInsert(entry: Entry, total: number, w: number): HTMLCanvasElement {
  const h = Math.round(w * INSERT_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  const m = Math.round(w * 0.03);
  const ink = inkOf(entry);

  ctx.fillStyle = STOCK;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = ink;
  ctx.fillRect(m, m, w - 2 * m, h - 2 * m);

  const left = m + w * 0.07;
  const right = w - m - w * 0.07;
  ctx.fillStyle = STOCK;
  ctx.textBaseline = "alphabetic";

  // Catalogue number: the key.
  ctx.font = `500 ${w * 0.042}px "Archivo Label"`;
  ctx.letterSpacing = `${w * 0.0025}px`;
  ctx.fillText(formatNo(entry.no), left, m + h * 0.095);

  // Hairline under the number, like a printed rule.
  ctx.globalAlpha = 0.45;
  ctx.fillRect(left, m + h * 0.118, right - left, Math.max(1, w * 0.0035));
  ctx.globalAlpha = 1;

  // Title in the serif cover cut.
  const size = w * 0.108;
  ctx.font = `400 ${size}px "Fraunces Cover"`;
  ctx.letterSpacing = `${-size * 0.012}px`;
  const lines = wrap(ctx, entry.title, right - left, 6);
  let y = m + h * 0.235 + size * 0.8;
  for (const line of lines) {
    ctx.fillText(line, left, y);
    y += size * 1.0;
  }

  // Imprint and meta in small print.
  ctx.font = `500 ${w * 0.031}px "Archivo Label"`;
  ctx.letterSpacing = `${w * 0.0035}px`;
  const meta = [entry.code, entry.year, entry.stargazers_count > 0 ? `${entry.stargazers_count} ★` : null].filter(Boolean).join("  ·  ");
  ctx.fillText(meta.toUpperCase(), left, h - m - h * 0.095);
  ctx.globalAlpha = 0.72;
  ctx.font = `400 ${w * 0.03}px "Fraunces Text"`;
  ctx.letterSpacing = "0px";
  ctx.fillText("Ethan Lee Barrett", left, h - m - h * 0.058);
  ctx.globalAlpha = 1;

  // Position mark, bottom right.
  const r = w * 0.065;
  positionMark(ctx, right - r, h - m - h * 0.078 - r * 0.2, r, markAngle(entry, total), Math.max(1, w * 0.004), STOCK);
  return canvas;
}

/** Spine: text runs top to bottom, number first, language code last. */
export function drawSpine(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * SPINE_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = inkOf(entry);
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w, 0);
  ctx.rotate(Math.PI / 2);
  // Now x runs down the spine (0..h) and y across it (0..w).
  ctx.fillStyle = STOCK;
  ctx.textBaseline = "middle";
  const mid = w * 0.5 + w * 0.02;
  const pad = h * 0.025;
  ctx.font = `600 ${w * 0.42}px "Archivo Spine"`;
  ctx.letterSpacing = `${w * 0.01}px`;
  const no = formatNo(entry.no);
  ctx.fillText(no, pad, mid);
  const noWidth = ctx.measureText(no).width;

  ctx.font = `500 ${w * 0.34}px "Archivo Spine"`;
  const code = entry.code;
  const codeWidth = ctx.measureText(code).width;
  ctx.fillText(code, h - pad - codeWidth, mid);

  ctx.font = `400 ${w * 0.40}px "Archivo Spine"`;
  ctx.letterSpacing = `${w * 0.004}px`;
  const start = pad + noWidth + w * 0.55;
  const avail = h - pad - codeWidth - w * 0.5 - start;
  let title = entry.name;
  while (title.length > 2 && ctx.measureText(title).width > avail) title = title.slice(0, -1);
  if (title !== entry.name) title = title.replace(/[-_ ]+$/, "") + "…";
  ctx.fillText(title, start, mid);
  ctx.restore();
  return canvas;
}

/** Inside left: the booklet sheet with the printed description. */
export function drawInsideLeft(entry: Entry, total: number, w: number): HTMLCanvasElement {
  const h = Math.round(w * INSERT_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = STOCK_RAISED;
  ctx.fillRect(0, 0, w, h);
  // Pocket: the lower sheet that holds the booklet.
  ctx.fillStyle = STOCK_DEEP;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.fillStyle = "#221F1C";
  const left = w * 0.1;
  const right = w * 0.9;
  ctx.font = `500 ${w * 0.036}px "Archivo Label"`;
  ctx.letterSpacing = `${w * 0.003}px`;
  ctx.fillText(formatNo(entry.no).toUpperCase(), left, h * 0.11);
  ctx.font = `400 ${w * 0.07}px "Fraunces Cover"`;
  ctx.letterSpacing = "0px";
  const tl = wrap(ctx, entry.title, right - left, 3);
  let y = h * 0.2;
  for (const line of tl) {
    ctx.fillText(line, left, y);
    y += w * 0.072;
  }
  ctx.font = `400 ${w * 0.036}px "Fraunces Text"`;
  const desc = entry.description?.trim() || "No description on GitHub yet.";
  const dl = wrap(ctx, desc, right - left, 7);
  y += w * 0.03;
  for (const line of dl) {
    ctx.fillText(line, left, y);
    y += w * 0.05;
  }
  positionMark(ctx, right - w * 0.06, h * 0.9, w * 0.05, markAngle(entry, total), Math.max(1, w * 0.004), "#221F1C");
  ctx.font = `500 ${w * 0.03}px "Archivo Label"`;
  ctx.letterSpacing = `${w * 0.003}px`;
  ctx.fillText("READ THE FULL NOTES IN THE BOOKLET", left, h * 0.9 + w * 0.012);
  return canvas;
}

/** Inside right: the tray and the disc. */
export function drawInsideRight(entry: Entry, w: number): HTMLCanvasElement {
  const h = Math.round(w * INSERT_ASPECT);
  const [canvas, ctx] = makeCanvas(w, h);
  const ink = inkOf(entry);
  ctx.fillStyle = darken(ink, 0.3);
  ctx.fillRect(0, 0, w, h);
  // Tray recess.
  ctx.fillStyle = darken(ink, 0.42);
  ctx.fillRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88);
  // Disc.
  const cx = w * 0.5;
  const cy = h * 0.5;
  const R = w * 0.4;
  ctx.fillStyle = STOCK_RAISED;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.97, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = STOCK_RAISED;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = darken(ink, 0.42);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.07, 0, Math.PI * 2);
  ctx.fill();
  // Label text around the hub.
  ctx.fillStyle = STOCK_RAISED;
  ctx.textAlign = "center";
  ctx.font = `400 ${w * 0.06}px "Fraunces Cover"`;
  const lines = wrap(ctx, entry.title, R * 1.5, 2);
  let y = cy - R * 0.5;
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += w * 0.062;
  }
  ctx.font = `500 ${w * 0.034}px "Archivo Label"`;
  ctx.letterSpacing = `${w * 0.003}px`;
  ctx.fillText(formatNo(entry.no).toUpperCase(), cx, cy + R * 0.62);
  ctx.textAlign = "left";
  return canvas;
}

/** Edge colour for the sleeve sides. */
export function edgeColour(entry: Entry): string {
  return darken(inkOf(entry), 0.18);
}
