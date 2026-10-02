import { type AnyCanvas, type Ctx2D, context, makeCanvas } from "./art/canvas";
import { type Rand, hashSeed, range, rng, valueNoise } from "./random";

/**
 * Black metal logotypes (recipe/direction-v3.md), drawn, not typeset. There is no font
 * underneath. Each letter is a skeleton from an angular, narrow alphabet drawn with one
 * thin pen. Every free stroke end runs out into a needle; thorns grow from the peaks and
 * roots from the feet; barbs sit along the stems. The end letters tower over the middle
 * ones, and a frame of wings, sweeps and a centre spike is mirrored about the middle, so
 * the silhouette is symmetric while the letters are not. Last, an ink pass roughens every
 * edge the way a photocopy of a pen drawing does. The same name always grows the same
 * logo. It is an image of a word: the readable name is always set elsewhere in text.
 */

type Pt = [number, number];
interface Glyph {
  w: number;
  s: Pt[][];
}

// Skeletons in a box `w` wide and 1 tall (0 = cap line, 1 = baseline). Angular and narrow.
// Bowls are lozenges with pointed heads and feet, as in a gothic hand.
const O: Pt[] = [[0.27, -0.07], [0.54, 0.18], [0.54, 0.82], [0.27, 1.07], [0, 0.82], [0, 0.18], [0.27, -0.07]];
const P_BOWL: Pt[] = [[0, 1.06], [0, -0.04], [0.3, 0], [0.52, 0.16], [0.52, 0.36], [0.3, 0.52], [0, 0.52]];
const GLYPHS: Record<string, Glyph> = {
  A: { w: 0.56, s: [[[0, 1.04], [0, 0.26], [0.28, -0.08], [0.56, 0.26], [0.56, 1.04]], [[0, 0.56], [0.56, 0.56]]] },
  B: { w: 0.52, s: [[[0, -0.05], [0, 1.05]], [[0, 0], [0.3, 0], [0.5, 0.14], [0.5, 0.32], [0.3, 0.47], [0, 0.47]], [[0.3, 0.47], [0.52, 0.62], [0.52, 0.84], [0.3, 1], [0, 1]]] },
  C: { w: 0.48, s: [[[0.48, 0.16], [0.24, -0.07], [0, 0.18], [0, 0.82], [0.24, 1.07], [0.48, 0.84]]] },
  D: { w: 0.54, s: [[[0, -0.05], [0, 1.05]], [[0, 0], [0.24, 0], [0.54, 0.26], [0.54, 0.74], [0.24, 1], [0, 1]]] },
  E: { w: 0.46, s: [[[0.46, 0], [0, 0], [0, 1], [0.46, 1]], [[0, 0.48], [0.34, 0.48]]] },
  F: { w: 0.46, s: [[[0.46, 0], [0, 0], [0, 1]], [[0, 0.48], [0.34, 0.48]]] },
  G: { w: 0.52, s: [[[0.5, 0.16], [0.25, -0.07], [0, 0.18], [0, 0.82], [0.25, 1.07], [0.52, 0.84], [0.52, 0.56], [0.24, 0.56]]] },
  H: { w: 0.54, s: [[[0, 0], [0, 1]], [[0.54, 0], [0.54, 1]], [[0, 0.5], [0.54, 0.5]]] },
  I: { w: 0.06, s: [[[0.03, 0], [0.03, 1]]] },
  J: { w: 0.42, s: [[[0.42, -0.04], [0.42, 0.82], [0.2, 1.07], [0, 0.86]]] },
  K: { w: 0.52, s: [[[0, 0], [0, 1]], [[0.52, 0], [0, 0.56]], [[0.18, 0.4], [0.54, 1]]] },
  L: { w: 0.44, s: [[[0, 0], [0, 1], [0.44, 1]]] },
  M: { w: 0.7, s: [[[0, 1.04], [0, -0.06], [0.35, 0.5], [0.7, -0.06], [0.7, 1.04]]] },
  N: { w: 0.56, s: [[[0, 1.04], [0, -0.06], [0.56, 1.06], [0.56, -0.04]]] },
  O: { w: 0.54, s: [O] },
  P: { w: 0.52, s: [P_BOWL] },
  Q: { w: 0.54, s: [O, [[0.3, 0.78], [0.62, 1.12]]] },
  R: { w: 0.54, s: [P_BOWL, [[0.26, 0.52], [0.54, 1]]] },
  S: { w: 0.5, s: [[[0.5, 0.14], [0.25, -0.07], [0, 0.16], [0, 0.34], [0.5, 0.64], [0.5, 0.84], [0.25, 1.07], [0, 0.86]]] },
  T: { w: 0.54, s: [[[0, 0], [0.54, 0]], [[0.27, 0], [0.27, 1]]] },
  U: { w: 0.54, s: [[[0, -0.04], [0, 0.82], [0.27, 1.07], [0.54, 0.82], [0.54, -0.04]]] },
  V: { w: 0.56, s: [[[0, -0.04], [0.28, 1.08], [0.56, -0.04]]] },
  W: { w: 0.76, s: [[[0, -0.04], [0.19, 1.08], [0.38, 0.3], [0.57, 1.08], [0.76, -0.04]]] },
  X: { w: 0.54, s: [[[0, 0], [0.54, 1]], [[0.54, 0], [0, 1]]] },
  Y: { w: 0.54, s: [[[0, 0], [0.27, 0.5], [0.54, 0]], [[0.27, 0.5], [0.27, 1]]] },
  Z: { w: 0.5, s: [[[0, 0], [0.5, 0], [0, 1], [0.5, 1]]] },
  "0": { w: 0.5, s: [[[0.13, 0], [0.37, 0], [0.5, 0.13], [0.5, 0.87], [0.37, 1], [0.13, 1], [0, 0.87], [0, 0.13], [0.13, 0]]] },
  "1": { w: 0.26, s: [[[0, 0.16], [0.22, 0], [0.22, 1]]] },
  "2": { w: 0.5, s: [[[0, 0.14], [0.14, 0], [0.38, 0], [0.5, 0.14], [0.5, 0.38], [0, 1], [0.5, 1]]] },
  "3": { w: 0.5, s: [[[0, 0.1], [0.12, 0], [0.38, 0], [0.5, 0.12], [0.5, 0.36], [0.36, 0.48], [0.14, 0.48]], [[0.36, 0.48], [0.5, 0.6], [0.5, 0.88], [0.38, 1], [0.12, 1], [0, 0.9]]] },
  "4": { w: 0.52, s: [[[0.38, 1], [0.38, 0], [0, 0.66], [0.52, 0.66]]] },
  "5": { w: 0.5, s: [[[0.48, 0], [0.04, 0], [0, 0.46], [0.36, 0.44], [0.5, 0.58], [0.5, 0.88], [0.38, 1], [0.12, 1], [0, 0.9]]] },
  "6": { w: 0.5, s: [[[0.46, 0.08], [0.34, 0], [0.14, 0], [0, 0.14], [0, 0.86], [0.14, 1], [0.38, 1], [0.5, 0.88], [0.5, 0.6], [0.38, 0.48], [0, 0.5]]] },
  "7": { w: 0.5, s: [[[0, 0], [0.5, 0], [0.16, 1]]] },
  "8": { w: 0.5, s: [[[0.12, 0.47], [0, 0.36], [0, 0.12], [0.12, 0], [0.38, 0], [0.5, 0.12], [0.5, 0.36], [0.38, 0.47], [0.12, 0.47], [0, 0.6], [0, 0.88], [0.12, 1], [0.38, 1], [0.5, 0.88], [0.5, 0.6], [0.38, 0.47]]] },
  "9": { w: 0.5, s: [[[0.04, 0.92], [0.16, 1], [0.36, 1], [0.5, 0.86], [0.5, 0.14], [0.36, 0], [0.12, 0], [0, 0.12], [0, 0.4], [0.12, 0.52], [0.5, 0.5]]] },
  "-": { w: 0.3, s: [[[0, 0.56], [0.3, 0.56]]] },
};

/** A tapered spike: a quadratic curve from base `a` through control `c` to tip `b`, `w` wide at the base. */
interface Thorn {
  a: Pt;
  c: Pt;
  b: Pt;
  w: number;
}
interface Stroke {
  pts: Pt[];
  w: number;
}
interface Geometry {
  strokes: Stroke[];
  thorns: Thorn[];
  box: [number, number, number, number];
  seed: number;
}

interface Hand {
  endBoost: number;
  arch: number;
  pen: number;
  spike: number;
  gap: number;
  narrow: number;
}

const dirOf = (angle: number): Pt => [Math.sin(angle), -Math.cos(angle)]; // 0 = up, π/2 = right
const angleOf = (d: Pt): number => Math.atan2(d[0], -d[1]);
const bez = (t: Thorn, u: number): Pt => {
  const v = 1 - u;
  return [v * v * t.a[0] + 2 * v * u * t.c[0] + u * u * t.b[0], v * v * t.a[1] + 2 * v * u * t.c[1] + u * u * t.b[1]];
};
const bezDir = (t: Thorn, u: number): Pt => {
  const dx = 2 * (1 - u) * (t.c[0] - t.a[0]) + 2 * u * (t.b[0] - t.c[0]);
  const dy = 2 * (1 - u) * (t.c[1] - t.a[1]) + 2 * u * (t.b[1] - t.c[1]);
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
};

/** Grow a thorn and, at depth, its side branches. `bend` curves it sideways as a share of its length. */
function grow(out: Thorn[], r: Rand, base: Pt, angle: number, len: number, w: number, bend: number, depth: number): void {
  const d = dirOf(angle);
  const n: Pt = [-d[1], d[0]];
  const b: Pt = [base[0] + d[0] * len, base[1] + d[1] * len];
  const c: Pt = [base[0] + d[0] * len * 0.5 + n[0] * len * bend, base[1] + d[1] * len * 0.5 + n[1] * len * bend];
  const t: Thorn = { a: base, c, b, w };
  out.push(t);
  if (depth <= 0 || len < 0.3) return;
  // Branches leave at acute angles and run long, like thorns on a briar, not twigs.
  const branches = r() < 0.65 ? 1 : 2;
  for (let k = 0; k < branches; k++) {
    const u = range(r, 0.22, 0.6);
    const at = bez(t, u);
    const side = k === 0 ? (r() < 0.5 ? -1 : 1) : -Math.sign(bend || 1);
    const a = angleOf(bezDir(t, u)) + side * range(r, 0.22, 0.5);
    grow(out, r, at, a, len * (1 - u) * range(r, 0.55, 0.9), w * (1 - u) ** 1.2 * 0.9, side * range(r, 0.02, 0.12), depth - 1);
  }
}

function mirrored(t: Thorn, axis: number): Thorn {
  const m = (p: Pt): Pt => [2 * axis - p[0], p[1]];
  return { a: m(t.a), c: m(t.c), b: m(t.b), w: t.w };
}

/** Break the name into one to three balanced lines of words. */
function breakLines(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const len = (ws: string[]) => ws.join(" ").length;
  const total = len(words);
  if (words.length === 1 || total <= 18) return [words.join(" ")];
  const k = Math.min(words.length, total <= 34 ? 2 : 3);
  let best: string[] = [words.join(" ")];
  let bestMax = Infinity;
  const walk = (start: number, left: number, acc: string[]): void => {
    if (left === 1) {
      const lines = [...acc, words.slice(start).join(" ")];
      const m = Math.max(...lines.map((l) => l.length));
      if (m < bestMax) {
        bestMax = m;
        best = lines;
      }
      return;
    }
    for (let i = start + 1; i <= words.length - left + 1; i++) walk(i, left - 1, [...acc, words.slice(start, i).join(" ")]);
  };
  walk(0, k, []);
  return best;
}

const isClosed = (st: Pt[]): boolean => st[0][0] === st[st.length - 1][0] && st[0][1] === st[st.length - 1][1];

/** Lay out one line of letters centred on x = 0 with its midline at `y0`, and grow its thorns. */
function setLine(word: string, r: Rand, y0: number, role: "only" | "top" | "mid" | "bottom", hand: Hand, geo: Geometry, wobble: (x: number, y: number) => number): void {
  const chars = [...word.toUpperCase()].filter((ch) => ch === " " || GLYPHS[ch]);
  if (!chars.length) return;
  const space = 0.3;
  // Pass 1, nominal advances, to find each letter's distance from the middle.
  const nominal = chars.map((ch) => (ch === " " ? space : GLYPHS[ch].w * hand.narrow + hand.gap));
  const T = nominal.reduce((a, b) => a + b, 0);
  let acc = 0;
  const u = nominal.map((a) => {
    const c = acc + a / 2;
    acc += a;
    return Math.min(1, Math.abs((2 * c) / T - 1));
  });
  // Pass 2, scaled: the end letters tower over the middle ones.
  const scale = u.map((v) => 1 + hand.endBoost * v ** 3);
  const adv = chars.map((ch, i) => (ch === " " ? space : (GLYPHS[ch].w * hand.narrow + hand.gap) * scale[i]));
  const W = adv.reduce((a, b) => a + b, 0) - hand.gap * scale[scale.length - 1];
  let x = -W / 2;
  const letters: { x0: number; x1: number; top: number; bottom: number; mid: number; s: number; pts: Pt[] }[] = [];
  chars.forEach((ch, i) => {
    const s = scale[i];
    const mid = y0 - hand.arch * (1 - u[i] ** 2);
    if (ch !== " ") {
      const g = GLYPHS[ch];
      const top = mid - s / 2;
      const gw = g.w * hand.narrow * s;
      const cx = x + gw / 2;
      const rot = range(r, -0.03, 0.03);
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const pen = hand.pen * Math.sqrt(s);
      const place = (p: Pt): Pt => {
        const px = x + p[0] * hand.narrow * s - cx;
        const py = top + p[1] * s - mid;
        return [cx + px * cos - py * sin, mid + px * sin + py * cos];
      };
      const strokes = g.s.map((st) => st.map(place));
      const all: Pt[] = [];
      strokes.forEach((st, si) => {
        // Hand wobble: subdivide, then push each point along a smooth, slow noise field.
        const pts: Pt[] = [];
        for (let k = 0; k < st.length - 1; k++) {
          const [ax, ay] = st[k];
          const [bx, by] = st[k + 1];
          const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.12));
          for (let j = 0; j < n; j++) pts.push([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n]);
        }
        pts.push([...st[st.length - 1]] as Pt);
        for (const p of pts) {
          const ox = (wobble(p[0] * 1.3, p[1] * 1.3) - 0.5) * 0.03;
          const oy = (wobble(p[0] * 1.3 + 40, p[1] * 1.3) - 0.5) * 0.03;
          p[0] += ox;
          p[1] += oy;
        }
        strokes[si] = pts;
        all.push(...pts);
        geo.strokes.push({ pts, w: pen });
      });

      // Needles at the free ends of open strokes; vertical ends run long.
      g.s.forEach((st, si) => {
        if (isClosed(st)) return;
        const placed = strokes[si];
        for (const [end, prev] of [[placed[placed.length - 1], placed[placed.length - 2]], [placed[0], placed[1]]] as const) {
          const joined = strokes.some((o, oi) => oi !== si && nearStroke(end, o, 0.05 * s));
          if (joined && r() < 0.75) continue;
          const d: Pt = [end[0] - prev[0], end[1] - prev[1]];
          const l = Math.hypot(d[0], d[1]) || 1;
          const vertical = Math.abs(d[1] / l) > 0.6;
          const len = (vertical ? range(r, 0.22, 0.85) : range(r, 0.1, 0.38)) * hand.spike * s * (joined ? 0.5 : 1) * (0.85 + 0.5 * u[i]);
          grow(geo.thorns, r, end, angleOf([d[0] / l, d[1] / l]) + range(r, -0.1, 0.1), len, pen * 1.25, range(r, -0.12, 0.12), vertical && len > 0.5 ? 1 : 0);
        }
      });

      // Thorns from the peaks, roots from the feet (corners only; ends already have needles).
      const crowns: Pt[] = [];
      const roots: Pt[] = [];
      strokes.forEach((st, si) => {
        const closed = isClosed(g.s[si]);
        st.forEach((p, k) => {
          if (!closed && (k === 0 || k === st.length - 1)) return;
          if (p[1] < top + 0.06 * s) crowns.push(p);
          else if (p[1] > top + 0.94 * s) roots.push(p);
        });
      });
      const lean = Math.max(-1, Math.min(1, cx / (W / 2))) * 0.4;
      for (const [sites, down] of [[crowns, false], [roots, true]] as const) {
        if (!sites.length || r() > 0.6) continue;
        const p = sites[Math.floor(r() * sites.length)];
        const a = (down ? Math.PI - lean : lean) + range(r, -0.16, 0.16);
        const len = range(r, 0.35, 0.95) * hand.spike * s * (0.8 + 0.6 * u[i]);
        grow(geo.thorns, r, p, a, len, pen * 1.2, range(r, -0.14, 0.14), r() < 0.22 ? 2 : 1);
      }

      // Barbs along the long strokes, raked toward the nearer end, like rose thorns.
      for (const st of strokes) {
        const a0 = st[0];
        const b0 = st[st.length - 1];
        for (let k = 0; k < st.length - 1; k += 2) {
          const [ax, ay] = st[k];
          const [bx, by] = st[Math.min(st.length - 1, k + 2)];
          const l = Math.hypot(bx - ax, by - ay);
          if (l < 0.2 * s || r() > 0.22) continue;
          const p: Pt = [(ax + bx) / 2, (ay + by) / 2];
          if (Math.hypot(p[0] - a0[0], p[1] - a0[1]) < 0.15 * s || Math.hypot(p[0] - b0[0], p[1] - b0[1]) < 0.15 * s) continue;
          const vertical = Math.abs(by - ay) / l > 0.7;
          const side = Math.sign(p[0] - cx) || (r() < 0.5 ? -1 : 1);
          const upper = p[1] < mid;
          const a = vertical ? (upper ? side * range(r, 0.35, 0.7) : Math.PI - side * range(r, 0.35, 0.7)) : (upper ? 0 : Math.PI) + range(r, -0.5, 0.5);
          grow(geo.thorns, r, p, a, range(r, 0.12, 0.3) * s * hand.spike, pen * 0.95, range(r, -0.18, 0.18), 0);
        }
      }
      letters.push({ x0: x, x1: x + gw, top, bottom: top + s, mid, s, pts: all });
    }
    x += adv[i];
  });
  if (!letters.length) return;

  const first = letters[0];
  const pen = hand.pen * Math.sqrt(first.s);
  const pairs: Thorn[][] = [];
  const centred: Thorn[] = [];
  const pts = letters.flatMap((l) => l.pts);
  /** The highest (or lowest) drawn point within `tol` of `xx`. */
  const extreme = (xx: number, down: boolean, tol = 0.14): Pt | null => {
    let best: Pt | null = null;
    for (const p of pts) if (Math.abs(p[0] - xx) < tol && (!best || (down ? p[1] > best[1] : p[1] < best[1]))) best = p;
    return best;
  };
  /** Grow a thorn tree on the left at `p`, and its mirror image rooted at the matching point on the right. */
  const pair = (p: Pt, q: Pt, angle: number, len: number, w: number, bend: number, depth: number): void => {
    const left: Thorn[] = [];
    grow(left, r, p, angle, len, w, bend, depth);
    const dx = q[0] - -p[0];
    const dy = q[1] - p[1];
    pairs.push(left, left.map((t) => {
      const m = mirrored(t, 0);
      return { a: [m.a[0] + dx, m.a[1] + dy], c: [m.c[0] + dx, m.c[1] + dy], b: [m.b[0] + dx, m.b[1] + dy], w: m.w };
    }));
  };

  // Wings from the end letters, mirrored.
  if (role !== "bottom" && r() < 0.9) {
    const p: Pt = [first.x0 + pen * 0.4, first.top + 0.12 * first.s];
    pair(p, [-p[0], p[1]], -Math.PI / 2 + range(r, 0.3, 0.8), range(r, 0.9, 1.7) * hand.spike * first.s, pen * 1.5, range(r, 0.1, 0.24), 1);
  }
  if (role !== "top" && r() < 0.85) {
    const p: Pt = [first.x0 + pen * 0.4, first.bottom - 0.12 * first.s];
    pair(p, [-p[0], p[1]], -Math.PI / 2 - range(r, 0.25, 0.65), range(r, 0.8, 1.5) * hand.spike * first.s, pen * 1.45, -range(r, 0.08, 0.22), 1);
  }
  // Spike columns: long thorns at matching distances either side of the middle, each rooted
  // in the nearest stroke on its own side.
  const columns = Math.round(range(r, 1, 3.4));
  for (let k = 0; k < columns; k++) {
    const xx = (W / 2) * range(r, 0.18, 0.8);
    for (const down of [false, true]) {
      if ((down && role === "top") || (!down && role === "bottom") || r() > 0.7) continue;
      const p = extreme(-xx, down);
      const q = extreme(xx, down);
      if (!p || !q) continue;
      const lean = range(r, 0.05, 0.4) * (xx / (W / 2));
      const a = down ? Math.PI + lean : -lean;
      pair(p, q, a, range(r, 0.7, 1.6) * hand.spike, pen * 1.35, range(r, -0.12, 0.12), r() < 0.55 ? 2 : 1);
    }
  }
  // Sweeps under (and sometimes over) the word from the end letters toward the middle.
  const lowest = Math.max(...letters.map((l) => l.bottom));
  const highest = Math.min(...letters.map((l) => l.top));
  if ((role === "only" || role === "bottom") && r() < 0.6) {
    const sweep: Thorn = {
      a: [first.x0 + 0.06 * first.s, first.bottom - 0.04],
      c: [first.x0 + W * range(r, 0.04, 0.12), lowest + range(r, 0.45, 0.75)],
      b: [-W * range(r, 0.06, 0.2), lowest + range(r, 0.22, 0.42)],
      w: pen * 1.5,
    };
    const set: Thorn[] = [sweep];
    for (const t of [0.3, 0.55, 0.78]) if (r() < 0.75) grow(set, r, bez(sweep, t), Math.PI + range(r, -0.3, 0.3), range(r, 0.16, 0.45) * hand.spike, pen * 1.1 * (1 - t), range(r, -0.12, 0.12), 0);
    pairs.push(set, set.map((t) => mirrored(t, 0)));
  }
  if ((role === "only" || role === "top") && r() < 0.3) {
    const sweep: Thorn = {
      a: [first.x0 + 0.06 * first.s, first.top + 0.04],
      c: [first.x0 + W * range(r, 0.04, 0.12), highest - range(r, 0.45, 0.7)],
      b: [-W * range(r, 0.06, 0.2), highest - range(r, 0.22, 0.4)],
      w: pen * 1.4,
    };
    const set: Thorn[] = [sweep];
    for (const t of [0.35, 0.7]) if (r() < 0.7) grow(set, r, bez(sweep, t), range(r, -0.3, 0.3), range(r, 0.16, 0.4) * hand.spike, pen * (1 - t), range(r, -0.12, 0.12), 0);
    pairs.push(set, set.map((t) => mirrored(t, 0)));
  }
  // The centre spike, with its branches in mirrored pairs, where a letter sits on the axis.
  for (const down of [false, true]) {
    if ((down && role === "top") || (!down && role === "bottom") || r() > 0.7) continue;
    const base = extreme(0, down, 0.06);
    if (!base) continue;
    const len = (down ? range(r, 0.6, 1.2) : range(r, 0.9, 1.7)) * hand.spike;
    const tip: Pt = [0, base[1] + (down ? len : -len)];
    const spine: Thorn = { a: [0, base[1]], c: [0, (base[1] + tip[1]) / 2], b: tip, w: pen * 1.6 };
    centred.push(spine);
    const n = r() < 0.5 ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const t = range(r, 0.2, 0.55);
      const a = range(r, 0.3, 0.6);
      const half: Thorn[] = [];
      grow(half, r, bez(spine, t), down ? Math.PI - a : a, len * (1 - t) * range(r, 0.5, 0.8), pen * 1.2 * (1 - t), range(r, -0.12, 0.04), 0);
      for (const h of half) centred.push(h, mirrored(h, 0));
    }
  }
  for (const set of pairs) geo.thorns.push(...set);
  geo.thorns.push(...centred);
}

function nearStroke(p: Pt, st: Pt[], tol: number): boolean {
  for (let k = 0; k < st.length - 1; k++) {
    const [ax, ay] = st[k];
    const [bx, by] = st[k + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2));
    if (Math.hypot(ax + dx * t - p[0], ay + dy * t - p[1]) < tol) return true;
  }
  return false;
}

const geometryCache = new Map<string, Geometry>();

function geometry(text: string): Geometry {
  const key = text.trim().toLowerCase();
  const hit = geometryCache.get(key);
  if (hit) return hit;
  const seed = hashSeed(`logo:${key}`);
  const r = rng(seed);
  const hand: Hand = {
    endBoost: range(r, 0.45, 0.95),
    arch: range(r, -0.14, 0.2),
    pen: range(r, 0.05, 0.066),
    spike: range(r, 1, 1.45),
    gap: range(r, 0, 0.045),
    narrow: range(r, 0.6, 0.76),
  };
  const geo: Geometry = { strokes: [], thorns: [], box: [0, 0, 0, 0], seed };
  const wobble = valueNoise(seed ^ 0x9e3779b9);
  const lines = breakLines(key);
  const step = 1 + hand.endBoost * 0.45 + 0.42;
  lines.forEach((line, i) => {
    const role = lines.length === 1 ? "only" : i === 0 ? "top" : i === lines.length - 1 ? "bottom" : "mid";
    setLine(line, r, i * step, role, hand, geo, wobble);
  });
  // Bounds of everything drawn, with the pen's half-width.
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (p: Pt, pad: number) => {
    x0 = Math.min(x0, p[0] - pad);
    y0 = Math.min(y0, p[1] - pad);
    x1 = Math.max(x1, p[0] + pad);
    y1 = Math.max(y1, p[1] + pad);
  };
  for (const s of geo.strokes) for (const p of s.pts) add(p, s.w);
  for (const t of geo.thorns) {
    add(t.a, t.w);
    add(t.b, 0);
    add(bez(t, 0.5), t.w * 0.5);
  }
  geo.box = [x0, y0, x1, y1];
  geometryCache.set(key, geo);
  if (geometryCache.size > 200) geometryCache.delete(geometryCache.keys().next().value as string);
  return geo;
}

/** Width over height of the logo for `text`. */
export function logoAspect(text: string): number {
  const [x0, y0, x1, y1] = geometry(text).box;
  return (x1 - x0) / (y1 - y0);
}

const canvasCache = new Map<string, AnyCanvas>();

/**
 * The logo for `text` as a canvas `height` device pixels tall (its width follows from the
 * aspect), in `ink` on transparent. Sizes are bucketed so neighbouring requests share a canvas.
 */
/** Requested heights are bucketed so neighbouring sizes share one drawing (and one cache entry). */
export function logoBucket(height: number): number {
  return height < 120 ? Math.max(12, Math.round(height / 4) * 4) : Math.round(height / 24) * 24;
}

export function logoCanvas(text: string, height: number, ink = "#fff"): AnyCanvas {
  const bucket = logoBucket(height);
  const key = `${text.trim().toLowerCase()}|${bucket}|${ink}`;
  const hit = canvasCache.get(key);
  if (hit) return hit;
  const geo = geometry(text);
  const [x0, y0, x1, y1] = geo.box;
  // Small logos are drawn at twice the size and reduced, so the needles stay sharp.
  const k = bucket < 140 ? 2 : 1;
  const H = bucket * k;
  const scale = H / (y1 - y0);
  const pad = Math.ceil(3 * k);
  const W = Math.ceil((x1 - x0) * scale) + pad * 2;
  const Hc = Math.ceil(H) + pad * 2;
  const c = makeCanvas(W, Hc);
  const ctx = context(c, true);
  ctx.setTransform(scale, 0, 0, scale, pad - x0 * scale, pad - y0 * scale);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineJoin = "miter";
  ctx.miterLimit = 5;
  ctx.lineCap = "butt";
  // A nib: the whole stroke in the hairline, then the steep segments again at stem weight.
  const floor = (1.3 * k) / scale;
  for (const s of geo.strokes) {
    ctx.lineWidth = Math.max(s.w, floor);
    ctx.beginPath();
    s.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    ctx.lineWidth = Math.max(s.w * 1.7, floor * 1.5);
    ctx.beginPath();
    for (let i = 0; i < s.pts.length - 1; i++) {
      const [ax, ay] = s.pts[i];
      const [bx, by] = s.pts[i + 1];
      if (Math.abs(by - ay) > Math.abs(bx - ax) * 1.4) {
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
    }
    ctx.stroke();
  }
  for (const t of geo.thorns) fillThorn(ctx, t.w < floor * 1.2 ? { ...t, w: floor * 1.2 } : t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ink_(ctx, W, Hc, scale, geo.seed, ink);
  let out = c;
  if (k > 1) {
    out = makeCanvas(W / k, Hc / k);
    const o = context(out);
    o.imageSmoothingEnabled = true;
    o.imageSmoothingQuality = "high";
    o.drawImage(c, 0, 0, out.width, out.height);
  }
  canvasCache.set(key, out);
  if (canvasCache.size > 160) canvasCache.delete(canvasCache.keys().next().value as string);
  return out;
}

/** The logo for `text`, as large as fits in `maxW` by `maxH` device pixels. */
export function fitLogo(text: string, maxW: number, maxH: number, ink = "#fff"): AnyCanvas {
  const a = logoAspect(text);
  return logoCanvas(text, Math.max(12, Math.min(maxH, maxW / a)), ink);
}

/** Draw the logo into `ctx`, fitted to the box and centred in it. */
export function paintLogo(ctx: Ctx2D, text: string, x: number, y: number, w: number, h: number, ink = "#fff"): void {
  const logo = fitLogo(text, w, h, ink);
  const k = Math.min(w / logo.width, h / logo.height);
  const dw = logo.width * k;
  const dh = logo.height * k;
  ctx.drawImage(logo, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function fillThorn(ctx: Ctx2D, t: Thorn): void {
  const n = 14;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const p = bez(t, u);
    const d = bezDir(t, u);
    const hw = (t.w / 2) * (1 - u) ** 1.25;
    left.push([p[0] - d[1] * hw, p[1] + d[0] * hw]);
    right.push([p[0] + d[1] * hw, p[1] - d[0] * hw]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
}

/**
 * The ink pass: blur the drawing a little, add two octaves of noise, and threshold, so
 * edges go ragged, ink pools in the tight joins and the finest hairs break up, as in a
 * photocopy of a pen drawing. Then colour it.
 */
function ink_(ctx: Ctx2D, W: number, H: number, scale: number, seed: number, ink: string): void {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const n = W * H;
  let a: Float32Array = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = d[i * 4 + 3] / 255;
  const rad = Math.max(1, Math.round(scale * 0.012));
  a = boxBlur(a, W, H, rad);
  const coarse = valueNoise(seed ^ 0x51ed27);
  const fine = valueNoise(seed ^ 0x2c1b3c6d);
  const fc = 1 / Math.max(2, scale * 0.07);
  const ff = 1 / Math.max(1.2, scale * 0.02);
  const edge = 0.5 / rad;
  const [ir, ig, ib] = hex(ink);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = a[i];
      let out = 0;
      if (v > 0.02) {
        const nz = (coarse(x * fc, y * fc) - 0.5) * 0.5 + (fine(x * ff, y * ff) - 0.5) * 0.36;
        const t = v + nz * 0.5;
        out = Math.max(0, Math.min(1, (t - 0.5) / edge + 0.5));
      }
      d[i * 4] = ir;
      d[i * 4 + 1] = ig;
      d[i * 4 + 2] = ib;
      d[i * 4 + 3] = Math.round(out * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}

function boxBlur(src: Float32Array, W: number, H: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const span = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    let s = 0;
    const row = y * W;
    for (let x = -r; x <= r; x++) s += src[row + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[row + x] = s / span;
      s += src[row + Math.min(W - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = s / span;
      s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  return out;
}

function hex(c: string): [number, number, number] {
  const h = c.replace("#", "");
  const v = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
