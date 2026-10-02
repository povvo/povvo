import { hashSeed, rng, type Rand } from "./tiles";

/**
 * Black metal logotype generator (procedural motion: deterministic construction). The name is
 * set in a blackletter base, its letters stretched, crowded and jostled; thorns grow from the
 * peaks of the strokes and roots from their feet, mirrored about the centre the way a hand-
 * drawn band logo is; sweeping spears leave the first and last letters. The same name always
 * grows the same logo. It is an image of a word: the readable name is always set elsewhere.
 */

export interface MetalOptions {
  ink: string;
  /** CSS font family of the blackletter base, e.g. '"Metal Base"'. */
  font: string;
  weight?: number;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Logo for `text` with a base size of `size` px. Returns a tightly cropped canvas. */
export function metalLogo(text: string, size: number, o: MetalOptions): HTMLCanvasElement {
  const bucket = Math.max(24, Math.round(size / 8) * 8);
  const key = `${text}|${bucket}|${o.ink}|${o.font}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const logo = grow(text, bucket, o);
  cache.set(key, logo);
  if (cache.size > 80) cache.delete(cache.keys().next().value as string);
  return logo;
}

function grow(text: string, S: number, o: MetalOptions): HTMLCanvasElement {
  const r = rng(hashSeed(`metal:${text.toLowerCase()}`));
  const word = text.toLowerCase();
  const font = `${o.weight ?? 700} ${S}px ${o.font}`;
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = font;
  const crowd = 0.76;
  const advances = [...word].map((ch) => probe.measureText(ch).width * (ch === " " ? 0.55 : crowd));
  const textW = advances.reduce((a, b) => a + b, 0);
  const pad = S * 2.1;
  const W = Math.ceil(textW + pad * 2);
  const H = Math.ceil(S * 4.4);
  const y0 = H * 0.6;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = o.ink;
  ctx.strokeStyle = o.ink;
  ctx.font = font;
  ctx.textBaseline = "alphabetic";

  // Letters: stretched tall and unevenly, crowded into each other, each jostled. The first
  // and last letters tower, the way a hand-drawn logo frames itself.
  let x = pad;
  const letters = [...word];
  letters.forEach((ch, i) => {
    if (ch !== " ") {
      const edge = i === 0 || i === letters.length - 1 ? 0.45 : 0;
      ctx.save();
      ctx.translate(x, y0 + (r() - 0.5) * S * 0.18);
      ctx.rotate((r() - 0.5) * 0.12);
      ctx.scale(1 + (r() - 0.5) * 0.12, 1.5 + r() * 0.45 + edge);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
    x += advances[i];
  });

  // Where the ink is: the top and foot of every column.
  const img = ctx.getImageData(0, 0, W, H).data;
  const step = Math.max(2, Math.round(S * 0.04));
  const tops: { x: number; y: number }[] = [];
  const feet: { x: number; y: number }[] = [];
  let left = W;
  let right = 0;
  for (let cx = 0; cx < W; cx += step) {
    let top = -1;
    let foot = -1;
    for (let cy = 0; cy < H; cy++) {
      if (img[(cy * W + cx) * 4 + 3] > 140) {
        if (top < 0) top = cy;
        foot = cy;
      }
    }
    if (top >= 0) {
      tops.push({ x: cx, y: top });
      feet.push({ x: cx, y: foot });
      left = Math.min(left, cx);
      right = Math.max(right, cx);
    }
  }
  if (!tops.length) return c;
  const centre = (left + right) / 2;
  const half = Math.max(1, (right - left) / 2);

  // Peaks: columns at least as high as their neighbours, spaced apart.
  const peaks = (list: { x: number; y: number }[], up: boolean) => {
    const out: { x: number; y: number }[] = [];
    const reach = Math.max(1, Math.round((S * 0.14) / step));
    for (let i = 0; i < list.length; i++) {
      let best = true;
      for (let j = Math.max(0, i - reach); j <= Math.min(list.length - 1, i + reach); j++) {
        if (j !== i && (up ? list[j].y < list[i].y : list[j].y > list[i].y)) best = false;
      }
      if (best && (!out.length || list[i].x - out[out.length - 1].x > S * 0.14)) out.push(list[i]);
    }
    return out;
  };
  const topPeaks = peaks(tops, true);
  const footPeaks = peaks(feet, false);
  const nearest = (list: { x: number; y: number }[], tx: number) => list.reduce((a, b) => (Math.abs(b.x - tx) < Math.abs(a.x - tx) ? b : a));

  // Thorns on the left half, mirrored onto the right so the logo is symmetrical in its growth.
  const tips: { x: number; y: number }[] = [];
  for (const p of topPeaks) {
    if (p.x > centre) continue;
    if (r() > 0.92) continue;
    const outward = Math.abs(p.x - centre) / half;
    const length = S * (0.45 + r() * 1.05) * (0.75 + outward * 1.0);
    const lean = (r() - 0.5) * 0.55 - outward * 0.4;
    const width = S * (0.05 + r() * 0.06);
    const barbs = Math.floor(r() * 4);
    tips.push({ x: p.x + Math.cos(-Math.PI / 2 + lean) * length * 0.7, y: p.y + Math.sin(-Math.PI / 2 + lean) * length * 0.7 });
    const seed = r();
    thorn(ctx, p.x, p.y + S * 0.04, -Math.PI / 2 + lean, length, width, barbs, rng(hashSeed(`${seed}`)));
    const m = nearest(topPeaks, centre * 2 - p.x);
    if (Math.abs(m.x - (centre * 2 - p.x)) < S * 0.35) thorn(ctx, m.x, m.y + S * 0.04, -Math.PI / 2 - lean, length, width, barbs, rng(hashSeed(`${seed}`)));
  }
  // Branches knot neighbouring thorns together across the top, mirrored.
  for (let i = 0; i + 1 < tips.length; i++) {
    if (r() > 0.45) continue;
    const a = tips[i];
    const b = tips[i + 1];
    const sag = S * (0.1 + r() * 0.25);
    vine(ctx, a.x, a.y, b.x, b.y, sag, S * 0.035);
    vine(ctx, centre * 2 - a.x, a.y, centre * 2 - b.x, b.y, sag, S * 0.035);
  }
  for (const p of footPeaks) {
    if (p.x > centre) continue;
    if (r() > 0.6) continue;
    const length = S * (0.22 + r() * 0.75);
    const lean = (r() - 0.5) * 0.4;
    const width = S * (0.045 + r() * 0.04);
    const drip = r() < 0.4;
    const seed = r();
    root(ctx, p.x, p.y - S * 0.04, Math.PI / 2 + lean, length, width, drip, rng(hashSeed(`${seed}`)));
    const m = nearest(footPeaks, centre * 2 - p.x);
    if (Math.abs(m.x - (centre * 2 - p.x)) < S * 0.35) root(ctx, m.x, m.y - S * 0.04, Math.PI / 2 - lean, length, width, drip, rng(hashSeed(`${seed}`)));
  }

  // Spears from the first and last letters, curving up and out; sometimes a bar under the name.
  // Both draw from one seed, so the right spear mirrors the left barb for barb.
  const sweep = S * (1.1 + r() * 0.5);
  const lift = S * (0.5 + r() * 0.5);
  spear(ctx, left + S * 0.1, y0 - S * 0.25, -1, sweep, lift, S * 0.09, rng(hashSeed(`${text}:l`)));
  spear(ctx, right - S * 0.1, y0 - S * 0.25, 1, sweep, lift, S * 0.09, rng(hashSeed(`${text}:l`)));
  if (r() < 0.55) bar(ctx, left - S * 0.55, right + S * 0.55, y0 + S * 0.22, S * 0.07);

  return crop(c);
}

function taper(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, width: number, bend: number): { tx: number; ty: number } {
  const tx = x + Math.cos(angle) * length;
  const ty = y + Math.sin(angle) * length;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const mx = (x + tx) / 2 + nx * bend;
  const my = (y + ty) / 2 + ny * bend;
  ctx.beginPath();
  ctx.moveTo(x + nx * width * 0.5, y + ny * width * 0.5);
  ctx.quadraticCurveTo(mx + nx * width * 0.25, my + ny * width * 0.25, tx, ty);
  ctx.quadraticCurveTo(mx - nx * width * 0.25, my - ny * width * 0.25, x - nx * width * 0.5, y - ny * width * 0.5);
  ctx.closePath();
  ctx.fill();
  return { tx, ty };
}

function thorn(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, width: number, barbs: number, r: Rand): void {
  const bend = (r() - 0.5) * length * 0.18;
  taper(ctx, x, y, angle, length, width, bend);
  for (let b = 0; b < barbs; b++) {
    const t = 0.35 + r() * 0.45;
    const bx = x + Math.cos(angle) * length * t + -Math.sin(angle) * bend * 0.5;
    const by = y + Math.sin(angle) * length * t + Math.cos(angle) * bend * 0.5;
    const side = r() < 0.5 ? -1 : 1;
    taper(ctx, bx, by, angle + side * (0.6 + r() * 0.35), length * (0.18 + r() * 0.16), width * 0.7, 0);
  }
}

function root(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, width: number, drip: boolean, r: Rand): void {
  if (drip) {
    // A drip: a thin run with a round bead at the end.
    const { tx, ty } = taper(ctx, x, y, angle, length, width * 0.9, 0);
    ctx.beginPath();
    ctx.arc(tx, ty - width * 0.2, width * 0.55, 0, Math.PI * 2);
    ctx.fill();
  } else thorn(ctx, x, y, angle, length, width, r() < 0.4 ? 1 : 0, r);
}

function spear(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, sweep: number, lift: number, width: number, r: Rand): void {
  // A long tapered curve leaving the word sideways and rising at the end, with barbs.
  const ex = x + dir * sweep;
  const ey = y - lift;
  const cx = x + dir * sweep * 0.6;
  const cy = y + lift * 0.25;
  const n = 18;
  ctx.beginPath();
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex, y: (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ey });
  }
  const wAt = (i: number) => width * (1 - i / n) ** 0.8;
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.min(n, i + 1)];
    const b = pts[Math.max(0, i - 1)];
    const ang = Math.atan2(a.y - b.y, a.x - b.x);
    const px = pts[i].x - Math.sin(ang) * wAt(i) * 0.5;
    const py = pts[i].y + Math.cos(ang) * wAt(i) * 0.5;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let i = n; i >= 0; i--) {
    const a = pts[Math.min(n, i + 1)];
    const b = pts[Math.max(0, i - 1)];
    const ang = Math.atan2(a.y - b.y, a.x - b.x);
    ctx.lineTo(pts[i].x + Math.sin(ang) * wAt(i) * 0.5, pts[i].y - Math.cos(ang) * wAt(i) * 0.5);
  }
  ctx.closePath();
  ctx.fill();
  const barbs = 2 + Math.floor(r() * 2);
  for (let b = 1; b <= barbs; b++) {
    const i = Math.round((n * b) / (barbs + 1));
    const p = pts[i];
    taper(ctx, p.x, p.y, -Math.PI / 2 + dir * (0.35 + r() * 0.4), width * (2.2 + r() * 2), wAt(i) * 0.9, 0);
  }
}

function vine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, sag: number, width: number): void {
  // A thin curved branch between two thorn shafts, thickest in the middle.
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2 + sag;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx, my - width, x1, y1);
  ctx.quadraticCurveTo(mx, my + width, x0, y0);
  ctx.closePath();
  ctx.fill();
}

function bar(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, width: number): void {
  // A spear under the name, pointed at both ends.
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y - width * 0.9, x1, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + width * 0.9, x0, y);
  ctx.closePath();
  ctx.fill();
}

function crop(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const { width: W, height: H } = c;
  const d = ctx.getImageData(0, 0, W, H).data;
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0) return c;
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 3;
  out.height = y1 - y0 + 3;
  out.getContext("2d")!.drawImage(c, -x0 + 1, -y0 + 1);
  return out;
}
