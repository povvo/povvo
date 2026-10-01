import { type Rand, hashSeed, range, rng, valueNoise } from "./random";

/**
 * Cover photographs (recipe/direction-v3.md, covers): black-and-white night scenes, as if
 * shot on cheap film and run through a photocopier for a demo tape. A pine treeline in fog,
 * bare branches against a pale sky, ridgelines, or a moon. Painted in greys, then given a
 * crushed tone curve, heavy grain, a partial threshold and the odd toner streak. Deterministic
 * per seed.
 */

export type Scene = "forest" | "branches" | "ridge" | "moon";
export const SCENES: Scene[] = ["forest", "branches", "ridge", "moon"];

const grey = (v: number): string => {
  const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c},${c},${c})`;
};

function sky(ctx: CanvasRenderingContext2D, w: number, h: number, top: number, low: number, horizon: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h * horizon);
  g.addColorStop(0, grey(top));
  g.addColorStop(1, grey(low));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function fogBand(ctx: CanvasRenderingContext2D, w: number, y: number, depth: number, v: number, a: number): void {
  const g = ctx.createLinearGradient(0, y - depth, 0, y + depth * 0.4);
  g.addColorStop(0, `rgba(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)},0)`);
  g.addColorStop(0.7, `rgba(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)},${a})`);
  g.addColorStop(1, `rgba(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, y - depth, w, depth * 1.4);
}

/** A spruce: a spire of drooping tiers, ragged at the edges. */
function pine(ctx: CanvasRenderingContext2D, r: Rand, x: number, base: number, h: number): void {
  const top = base - h;
  const tiers = Math.max(5, Math.round(h / 7));
  const maxHalf = h * range(r, 0.16, 0.24);
  const left: [number, number][] = [[x, top]];
  const right: [number, number][] = [[x, top]];
  for (let i = 1; i <= tiers; i++) {
    const t = i / tiers;
    const y = top + h * t;
    const hw = maxHalf * t ** 0.9 * range(r, 0.75, 1.15);
    left.push([x - hw, y + h * 0.02], [x - hw * range(r, 0.3, 0.55), y + h * 0.035]);
    right.push([x + hw * range(r, 0.85, 1.1), y + h * 0.02], [x + hw * range(r, 0.3, 0.55), y + h * 0.035]);
  }
  ctx.beginPath();
  ctx.moveTo(x, top - h * 0.03);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(x, base + 2);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
}

function treeline(ctx: CanvasRenderingContext2D, r: Rand, w: number, h: number, base: number, hMin: number, hMax: number, v: number): void {
  ctx.fillStyle = grey(v);
  ctx.fillRect(0, base, w, h - base);
  let x = -10;
  while (x < w + 10) {
    pine(ctx, r, x, base + range(r, -2, 4), range(r, hMin, hMax));
    x += range(r, hMin * 0.12, hMin * 0.36);
  }
}

/** A bare tree: a trunk forking into thinner and thinner limbs. */
function limb(ctx: CanvasRenderingContext2D, r: Rand, x: number, y: number, len: number, angle: number, width: number, depth: number): void {
  const x2 = x + Math.sin(angle) * len;
  const y2 = y - Math.cos(angle) * len;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + Math.sin(angle + range(r, -0.3, 0.3)) * len * 0.5, y - Math.cos(angle) * len * 0.5, x2, y2);
  ctx.stroke();
  if (depth <= 0 || width < 0.6) return;
  const n = r() < 0.7 ? 2 : 3;
  for (let k = 0; k < n; k++) {
    // Limbs twist away from the line they came from, and the higher ones stay short.
    limb(ctx, r, x2, y2, len * range(r, 0.58, 0.8), angle + range(r, -0.85, 0.85), width * range(r, 0.55, 0.7), depth - 1);
  }
}

function ridgeLine(ctx: CanvasRenderingContext2D, r: Rand, w: number, h: number, base: number, amp: number, v: number): void {
  const n = 65;
  const ys: number[] = new Array(n).fill(0);
  // Midpoint displacement for a jagged skyline.
  const fill = (a: number, b: number, scale: number): void => {
    if (b - a < 2) return;
    const m = (a + b) >> 1;
    ys[m] = (ys[a] + ys[b]) / 2 + range(r, -1, 1) * scale;
    fill(a, m, scale * 0.55);
    fill(m, b, scale * 0.55);
  };
  ys[0] = range(r, -0.5, 0.5) * amp;
  ys[n - 1] = range(r, -0.5, 0.5) * amp;
  fill(0, n - 1, amp);
  ctx.fillStyle = grey(v);
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < n; i++) ctx.lineTo((i / (n - 1)) * w, base - Math.abs(ys[i]));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function moonDisc(ctx: CanvasRenderingContext2D, r: Rand, x: number, y: number, R: number): void {
  const halo = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 4);
  halo.addColorStop(0, "rgba(255,255,255,0.35)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(x - R * 4, y - R * 4, R * 8, R * 8);
  ctx.fillStyle = grey(0.92);
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  // Maria: a few soft dark patches.
  for (let k = 0; k < 6; k++) {
    const a = r() * Math.PI * 2;
    const d = R * range(r, 0, 0.6);
    const g = ctx.createRadialGradient(x + Math.cos(a) * d, y + Math.sin(a) * d, 0, x + Math.cos(a) * d, y + Math.sin(a) * d, R * range(r, 0.2, 0.45));
    g.addColorStop(0, "rgba(0,0,0,0.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Paint `scene` into a `w` by `h` greyscale canvas and run it through the copier. */
export function photograph(seed: string, scene: Scene, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const s = hashSeed(`photo:${seed}`);
  const r = rng(s);
  switch (scene) {
    case "forest": {
      sky(ctx, w, h, range(r, 0.12, 0.25), range(r, 0.55, 0.75), 0.62);
      if (r() < 0.5) moonDisc(ctx, r, w * range(r, 0.2, 0.8), h * range(r, 0.12, 0.3), w * range(r, 0.05, 0.09));
      treeline(ctx, r, w, h, h * 0.62, h * 0.12, h * 0.22, 0.42);
      fogBand(ctx, w, h * 0.64, h * 0.12, 0.7, 0.55);
      treeline(ctx, r, w, h, h * 0.76, h * 0.22, h * 0.4, 0.18);
      fogBand(ctx, w, h * 0.8, h * 0.1, 0.5, 0.3);
      treeline(ctx, r, w, h, h * 0.96, h * 0.4, h * 0.75, 0.02);
      break;
    }
    case "branches": {
      // A grey winter sky, darkest at the top where the logo sits.
      sky(ctx, w, h, range(r, 0.2, 0.3), range(r, 0.62, 0.74), 0.9);
      fogBand(ctx, w, h * 0.86, h * 0.2, 0.7, 0.5);
      ctx.strokeStyle = grey(0.04);
      ctx.lineCap = "round";
      const n = r() < 0.4 ? 1 : r() < 0.6 ? 2 : 3;
      for (let k = 0; k < n; k++) {
        const x = w * ((k + range(r, 0.2, 0.8)) / n);
        limb(ctx, r, x, h * 1.02, h * range(r, 0.2, 0.28), range(r, -0.18, 0.18), w * range(r, 0.018, 0.032), 8);
      }
      ctx.fillStyle = grey(0.05);
      ctx.fillRect(0, h * 0.95, w, h * 0.05);
      break;
    }
    case "ridge": {
      sky(ctx, w, h, range(r, 0.1, 0.2), range(r, 0.6, 0.78), 0.55);
      ridgeLine(ctx, r, w, h, h * 0.5, h * 0.16, 0.5);
      fogBand(ctx, w, h * 0.58, h * 0.14, 0.75, 0.6);
      ridgeLine(ctx, r, w, h, h * 0.66, h * 0.14, 0.24);
      fogBand(ctx, w, h * 0.74, h * 0.1, 0.55, 0.35);
      treeline(ctx, r, w, h, h * 0.94, h * 0.12, h * 0.26, 0.03);
      break;
    }
    default: {
      sky(ctx, w, h, 0.02, range(r, 0.16, 0.26), 1);
      moonDisc(ctx, r, w * range(r, 0.35, 0.65), h * range(r, 0.35, 0.55), w * range(r, 0.16, 0.24));
      // Thin cloud bands across the moon.
      const noise = valueNoise(s ^ 0x7f4a7c15);
      for (let y = 0; y < h; y += 2) {
        const a = Math.max(0, noise(1.5, y / (h * 0.05)) - 0.55) * 0.9;
        if (a <= 0) continue;
        ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
        ctx.fillRect(0, y, w, 2);
      }
      treeline(ctx, r, w, h, h * 0.97, h * 0.1, h * 0.22, 0.02);
    }
  }
  copier(ctx, c.width, c.height, s);
  return c;
}

/** Crushed tone, grain, a partial threshold and toner streaks. */
function copier(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const r = rng(seed ^ 0x3c6ef372);
  const blot = valueNoise(seed ^ 0x1b873593);
  const streaks = new Float32Array(h);
  for (let k = 0; k < 3; k++) {
    if (r() < 0.5) continue;
    const y = Math.floor(r() * h);
    const t = 1 + Math.floor(r() * 2);
    for (let j = 0; j < t; j++) if (y + j < h) streaks[y + j] = range(r, 0.08, 0.22);
  }
  const bs = 1 / Math.max(4, w * 0.04);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let v = d[i] / 255;
      // Tone: crush the shadows, lift the highlights.
      v = Math.max(0, Math.min(1, (v - 0.1) / 0.78));
      v = v * v * (3 - 2 * v);
      // Grain, blotchy toner, streaks.
      v += (r() + r() + r() - 1.5) * 0.16 + (blot(x * bs, y * bs) - 0.5) * 0.12 + streaks[y];
      // Partial threshold: a third of the way to one bit.
      const bit = v > 0.5 ? 1 : 0;
      v = v * 0.66 + bit * 0.34;
      const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
      d[i] = d[i + 1] = d[i + 2] = c;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Paper grain for the printed sheets: specks and faint toner dust on white. */
export function paperGrain(ctx: CanvasRenderingContext2D, w: number, h: number, seed: string): void {
  const r = rng(hashSeed(`paper:${seed}`));
  const n = Math.round((w * h) / 900);
  ctx.save();
  for (let k = 0; k < n; k++) {
    ctx.fillStyle = `rgba(0,0,0,${range(r, 0.04, 0.22).toFixed(3)})`;
    const s = range(r, 0.5, 1.6);
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.restore();
}
