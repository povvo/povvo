import { type Pic, drawFitted, logoArt, photoArt } from "./art";
import type { Entry } from "./catalogue";
import { logoAspect } from "./logo";
import { hashSeed } from "./random";
import { SCENES, type Scene, paperGrain } from "./xerox";

/**
 * Floppy labels (recipe/direction-v4.md, disks). A 3.5" disk's label is a white sticker, so
 * these are what a demo would have had: the logo photocopied in black across the top of the
 * sticker, a photocopied night photograph under it, and a line of small Helvetica at the foot.
 * One disk in five carries a black sticker with the logo alone in white. The label sits below
 * the shutter, so in the box only its top, the logo, shows above the disk in front.
 */

/** The label's printed area, width over height (72 by 56 mm). */
export const LABEL_ASPECT = 0.72 / 0.56;
/** The disk, width over height (90 by 94 mm). */
export const DISK_ASPECT = 0.9 / 0.94;

const SANS = '"Helvetica Neue", Helvetica, "Nimbus Sans", FreeSans, Arial, sans-serif';

export type Layout = Scene | "void";

export function layoutOf(entry: Entry): Layout {
  const h = hashSeed(`cover:${entry.name}`);
  return h % 5 === 0 ? "void" : SCENES[(h >>> 3) % SCENES.length];
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  // An alpha canvas gets greyscale antialiasing; an opaque one gets subpixel text with colour fringes.
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return [c, ctx];
}

/** Logo art sized to fit a box of `w` by `h` device pixels. */
function logoFor(text: string, w: number, h: number, ink: string, priority: number): Promise<Pic> {
  return logoArt(text, Math.max(12, Math.min(h, w / logoAspect(text))), ink, priority);
}

/** The pieces a label needs, requested together so the pool can draw them in parallel. */
function pieces(entry: Entry, w: number, priority: number): { layout: Layout; logo: Promise<Pic>; photo: Promise<Pic> | null } {
  const h = w / LABEL_ASPECT;
  const layout = layoutOf(entry);
  const m = w * 0.045;
  if (layout === "void") return { layout, logo: logoFor(entry.title, w * 0.84, h * 0.5, "#fff", priority), photo: null };
  return {
    layout,
    logo: logoFor(entry.title, w - 2 * m, h * 0.34 - m, "#000", priority),
    photo: photoArt(entry.name, layout, w - 2 * m, h * 0.47, priority),
  };
}

/** Request a label's art without drawing it (the boot screen warms the cache this way). */
export function warmLabel(entry: Entry, w: number, priority: number): Promise<unknown> {
  const p = pieces(entry, w, priority);
  return Promise.all([p.logo, p.photo]);
}

/** The label, `w` device pixels wide. */
export async function labelCanvas(entry: Entry, w: number, priority = 5): Promise<HTMLCanvasElement> {
  const h = Math.round(w / LABEL_ASPECT);
  const p = pieces(entry, w, priority);
  const [logo, photo] = await Promise.all([p.logo, p.photo]);
  const [c, ctx] = canvas(w, h);
  const m = w * 0.045;
  const dark = p.layout === "void";
  ctx.fillStyle = dark ? "#000" : "#fff";
  ctx.fillRect(0, 0, w, h);
  if (dark) {
    drawFitted(ctx, logo, w * 0.08, h * 0.16, w * 0.84, h * 0.5);
  } else {
    drawFitted(ctx, logo, m, m * 0.8, w - 2 * m, h * 0.34 - m);
    if (photo) ctx.drawImage(photo, m, h * 0.37, w - 2 * m, h * 0.47);
  }
  ctx.fillStyle = dark ? "#fff" : "#000";
  ctx.font = `400 ${(w * 0.04).toFixed(1)}px ${SANS}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Ethan Lee Barrett", m, h - m * 0.9);
  ctx.textAlign = "right";
  ctx.fillText(`${entry.language ?? "No language"} ${entry.born}`, w - m, h - m * 0.9);
  ctx.textAlign = "left";
  if (!dark) paperGrain(ctx, w, h, entry.name);
  return c;
}

// ---------- the disk in two dimensions (no-WebGL rack, boot screen) ----------

/** Disk coordinates (metres times ten, origin at the centre, y up) to canvas pixels. */
function at(w: number, x: number, y: number): [number, number] {
  const h = w / DISK_ASPECT;
  return [((x + 0.45) / 0.9) * w, ((0.47 - y) / 0.94) * h];
}

export function diskOutline(ctx: CanvasRenderingContext2D, w: number): void {
  const r = w * 0.014;
  const c = w * 0.045;
  const h = w / DISK_ASPECT;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - c, 0);
  ctx.lineTo(w, c);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
}

/** A drawing of the whole disk, front face: body, shutter, label, the arrow and the holes. */
export async function diskCanvas(entry: Entry, w: number, priority = 5): Promise<HTMLCanvasElement> {
  const h = Math.round(w / DISK_ASPECT);
  const label = await labelCanvas(entry, Math.round(w * 0.8), priority);
  const [c, ctx] = canvas(w, h);
  diskOutline(ctx, w);
  ctx.fillStyle = "#0e0e0e";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.stroke();
  // Shutter, closed, with its window over solid plastic.
  const [sx0, sy0] = at(w, -0.32, 0.47);
  const [sx1, sy1] = at(w, 0.2, 0.15);
  const metal = ctx.createLinearGradient(sx0, 0, sx1, 0);
  metal.addColorStop(0, "#9c9c9c");
  metal.addColorStop(0.45, "#e2e2e2");
  metal.addColorStop(1, "#8e8e8e");
  ctx.fillStyle = metal;
  ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  const [wx0, wy0] = at(w, -0.26, 0.44);
  const [wx1, wy1] = at(w, -0.14, 0.2);
  ctx.fillStyle = "#0e0e0e";
  ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
  // Label.
  const [lx0, ly0] = at(w, -0.36, 0.11);
  const [lx1, ly1] = at(w, 0.36, -0.45);
  ctx.drawImage(label, lx0, ly0, lx1 - lx0, ly1 - ly0);
  // The insertion arrow, and the write-protect and density holes.
  const [ax, ay] = at(w, -0.38, 0.43);
  const s = w * 0.035;
  ctx.fillStyle = "#262626";
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax + s * 0.6, ay + s);
  ctx.lineTo(ax - s * 0.6, ay + s);
  ctx.closePath();
  ctx.fill();
  for (const x of [-0.4, 0.4]) {
    const [hx, hy] = at(w, x - 0.02, -0.39);
    ctx.fillStyle = "#000";
    ctx.fillRect(hx, hy, w * 0.044, w * 0.044);
  }
  return c;
}
