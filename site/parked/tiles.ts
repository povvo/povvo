/**
 * The tile system (recipe/direction-v2.md, patchwork). Flat, hard-edged geometric tiles in
 * the collision palette (solid, checker, stripes, arc, split, diamond, bar, numeral), composed
 * into quilts with diamonds laid across the grid. Everything is a deterministic function of a
 * seed, so a project's patchwork never changes between visits. Used by the covers, the disc
 * label, the spread slab and the arrival curtain.
 */

/** The patchwork palette: saturated and unexpected in pairs (violet with aqua, magenta with sage, tan with indigo). */
export const TILE_COLOURS = [
  "#5200DC", // violet
  "#2EFFE3", // aqua
  "#14C9F8", // sky
  "#AE3571", // magenta
  "#9EAA75", // sage
  "#5D0E1A", // oxblood
  "#A6B414", // olive
  "#BAA07F", // tan
  "#8A4C0A", // brown
  "#0B1BA2", // indigo
  "#5452F2", // periwinkle
  "#7ED431", // green
  "#35C988", // mint
  "#DA0028", // red
  "#EFE61B", // acid
  "#F59AC7", // pink
  "#2E5B2D", // forest
  "#FF4B1F", // orange
  "#008C9A", // teal
] as const;

export type TileKind = "solid" | "checker" | "stripes" | "arc" | "split" | "diamond" | "bar" | "numeral";

export interface Tile {
  kind: TileKind;
  a: string;
  b: string;
  /** Quarter turns. */
  turn: number;
  /** Checker cells or stripe count. */
  n: number;
  text?: string;
}

export type Rand = () => number;

/** The numeral face, set by the cover system once the type roles are known. */
let numeralFont = (size: number): string => `900 ${size}px "Heat Display"`;
export function setNumeralFont(fn: (size: number) => string): void {
  numeralFont = fn;
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: small, fast and deterministic. */
export function rng(seed: number): Rand {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T,>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];

/** A sub-palette of `size` colours, always including `anchor` when given. */
export function subPalette(r: Rand, size: number, anchor?: string): string[] {
  const pool = TILE_COLOURS.filter((c) => c !== anchor);
  const out: string[] = anchor ? [anchor] : [];
  while (out.length < size && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

const KINDS: TileKind[] = ["solid", "checker", "stripes", "arc", "split", "diamond", "bar", "checker", "arc", "stripes", "solid"];

export function randomTile(r: Rand, palette: string[], avoid?: string): Tile {
  const choices = palette.filter((c) => c !== avoid);
  const a = pick(r, choices.length ? choices : palette);
  let b = pick(r, palette);
  for (let k = 0; k < 4 && b === a; k++) b = pick(r, palette);
  const kind = pick(r, KINDS);
  return { kind, a, b, turn: Math.floor(r() * 4), n: kind === "checker" ? pick(r, [2, 2, 3, 4]) : pick(r, [4, 5, 6, 8]) };
}

/** Draw one tile into the square (x, y, s). */
export function drawTile(ctx: CanvasRenderingContext2D, t: Tile, x: number, y: number, s: number, numeralFontOverride?: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, s, s);
  ctx.clip();
  ctx.translate(x + s / 2, y + s / 2);
  ctx.rotate((t.turn * Math.PI) / 2);
  ctx.translate(-s / 2, -s / 2);
  ctx.fillStyle = t.a;
  ctx.fillRect(-1, -1, s + 2, s + 2);
  ctx.fillStyle = t.b;
  switch (t.kind) {
    case "checker": {
      const c = s / t.n;
      for (let j = 0; j < t.n; j++) for (let i = 0; i < t.n; i++) if ((i + j) % 2) ctx.fillRect(i * c, j * c, c + 0.5, c + 0.5);
      break;
    }
    case "stripes": {
      const band = s / (t.n * 2);
      for (let k = 0; k < t.n; k++) ctx.fillRect(-1, k * band * 2 + band, s + 2, band);
      break;
    }
    case "arc": {
      ctx.beginPath();
      if (t.n % 2) ctx.arc(0, s, s, -Math.PI / 2, 0);
      else ctx.arc(s / 2, s, s / 2, Math.PI, 0);
      ctx.lineTo(0, s);
      ctx.fill();
      break;
    }
    case "split": {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "diamond": {
      ctx.beginPath();
      ctx.moveTo(s / 2, 0);
      ctx.lineTo(s, s / 2);
      ctx.lineTo(s / 2, s);
      ctx.lineTo(0, s / 2);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "bar": {
      ctx.translate(s / 2, s / 2);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-s, -s * 0.16, s * 2, s * 0.32);
      break;
    }
    case "numeral": {
      ctx.font = numeralFontOverride ?? numeralFont(s * 0.86);
      ctx.letterSpacing = "0px";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(t.text ?? "1", s / 2, s * 0.86);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/**
 * A large diamond laid across the grid, centred on (cx, cy) with half-diagonal h, filled
 * with stripes or a checker turned with it (the collage crossing the quilt's grid).
 */
export function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number, fill: Tile): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.lineTo(cx + h, cy);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(cx - h, cy);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = fill.a;
  ctx.fillRect(cx - h, cy - h, h * 2, h * 2);
  ctx.fillStyle = fill.b;
  if (fill.kind === "checker") {
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    const side = h * Math.SQRT2;
    const c = side / fill.n;
    for (let j = 0; j < fill.n; j++) for (let i = 0; i < fill.n; i++) if ((i + j) % 2) ctx.fillRect(-side / 2 + i * c, -side / 2 + j * c, c + 0.5, c + 0.5);
  } else {
    const band = (h * 2) / (fill.n * 2 + 1);
    for (let k = 0; k <= fill.n; k++) ctx.fillRect(cx - h, cy - h + k * band * 2, h * 2, band);
  }
  ctx.restore();
}

export interface QuiltOptions {
  cols: number;
  rows: number;
  palette: string[];
  /** Diamonds laid across grid intersections. */
  diamonds?: number;
  /** A numeral tile, placed once. */
  numeral?: string;
  numeralFont?: string;
}

/** A patchwork filling (x, y, w, h); cells are square, cropped at the far edges. */
export function drawQuilt(ctx: CanvasRenderingContext2D, r: Rand, x: number, y: number, w: number, h: number, o: QuiltOptions): void {
  const s = Math.max(w / o.cols, h / o.rows);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const cols = Math.ceil(w / s);
  const rows = Math.ceil(h / s);
  const above: string[] = [];
  const numeralAt = o.numeral ? Math.floor(r() * cols * rows) : -1;
  for (let j = 0; j < rows; j++) {
    let left: string | undefined;
    for (let i = 0; i < cols; i++) {
      const t = randomTile(r, o.palette, left ?? above[i]);
      if (j * cols + i === numeralAt) {
        t.kind = "numeral";
        t.turn = 0;
        t.text = o.numeral;
      }
      drawTile(ctx, t, x + i * s, y + j * s, s, o.numeralFont);
      left = t.a;
      above[i] = t.a;
    }
  }
  for (let d = 0; d < (o.diamonds ?? 0); d++) {
    const gi = 1 + Math.floor(r() * Math.max(1, cols - 1));
    const gj = 1 + Math.floor(r() * Math.max(1, rows - 1));
    const fill = randomTile(r, o.palette);
    fill.kind = r() < 0.6 ? "stripes" : "checker";
    fill.n = fill.kind === "checker" ? 2 : pick(r, [4, 5, 6]);
    drawDiamond(ctx, x + gi * s, y + gj * s, s, fill);
  }
  ctx.restore();
}

/**
 * An isometric solid whose three faces are small quilts (the patterned label on a disc).
 * Centred on (cx, cy) with radius R (centre to corner).
 */
export function drawTileCube(ctx: CanvasRenderingContext2D, r: Rand, cx: number, cy: number, R: number, palette: string[], numeralFont?: string): void {
  const c30 = Math.cos(Math.PI / 6) * R;
  const half = R / 2;
  // Each face maps the unit square by (origin, u, v).
  const faces: [number, number, number, number, number, number][] = [
    [cx, cy - R, c30, half, -c30, half], // top
    [cx - c30, cy - half, c30, half, 0, R], // left
    [cx, cy, c30, -half, 0, R], // right
  ];
  for (const [ox, oy, ux, uy, vx, vy] of faces) {
    ctx.save();
    ctx.transform(ux / 100, uy / 100, vx / 100, vy / 100, ox, oy);
    drawQuilt(ctx, r, 0, 0, 100, 100, { cols: 2, rows: 2, palette, numeral: r() < 0.4 ? "1" : undefined, numeralFont });
    ctx.restore();
  }
}
