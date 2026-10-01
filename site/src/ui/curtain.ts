import { ensureFonts } from "../covers";
import type { Store } from "../state";
import { drawQuilt, drawTile, hashSeed, rng, subPalette } from "../tiles";

/**
 * Arrival (narrative and editorial motion: one finite opening beat). A full-bleed patchwork
 * holds the screen like a title card, with the number of projects as its numeral; then it is
 * cut away tile by tile, hard cuts in a scattered order, to reveal the heat field (collision,
 * then drift). Once per session; never under reduced motion; never blocks input for long.
 */
export function mountCurtain(store: Store): void {
  if (store.state.motion === "reduced") return;
  try {
    if (sessionStorage.getItem("barrett-catalogue:curtain") === "seen") return;
    sessionStorage.setItem("barrett-catalogue:curtain", "seen");
  } catch {
    /* storage unavailable: show it */
  }
  const canvas = document.createElement("canvas");
  canvas.className = "curtain";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = innerWidth;
  const H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const cols = W >= 1024 ? 8 : 4;
  const size = Math.ceil(W / cols);
  const rows = Math.ceil(H / size);
  const r = rng(hashSeed(new Date().toDateString()));
  const palette = subPalette(r, 8);
  const art = document.createElement("canvas");
  art.width = canvas.width;
  art.height = canvas.height;
  const actx = art.getContext("2d")!;
  actx.scale(dpr, dpr);
  drawQuilt(actx, r, 0, 0, cols * size, rows * size, { cols, rows, palette, diamonds: 3 });
  ctx.drawImage(art, 0, 0, W, H);

  const cells: number[] = [];
  for (let k = 0; k < cols * rows; k++) cells.push(k);
  for (let k = cells.length - 1; k > 0; k--) {
    const j = Math.floor(r() * (k + 1));
    [cells[k], cells[j]] = [cells[j], cells[k]];
  }
  const gone = new Set<number>();
  // The title card: the count of projects set as the numeral, two cells square, near the middle.
  const ci = Math.floor(cols / 2) - 1;
  const cj = Math.max(0, Math.floor(rows / 2) - 1);
  let started = false;

  function paintCount(): void {
    const n = store.state.all.length;
    if (!n) return;
    void ensureFonts().then(() => {
      if (started && gone.size > cells.length * 0.3) return;
      drawTile(actx, { kind: "numeral", a: "#EFE61B", b: "#2E5B2D", turn: 0, n: 1, text: String(n) }, ci * size, cj * size, size * 2);
      redraw();
    });
  }

  function redraw(): void {
    ctx.clearRect(0, 0, W, H);
    for (let k = 0; k < cols * rows; k++) {
      if (gone.has(k)) continue;
      const i = k % cols;
      const j = Math.floor(k / cols);
      ctx.drawImage(art, i * size * dpr, j * size * dpr, size * dpr, size * dpr, i * size, j * size, size, size);
    }
  }

  function cut(): void {
    if (started) return;
    started = true;
    // Batches are timed against the clock, not counted per frame: on a slow device the cut
    // skips ahead and still ends on time instead of stalling half-cut.
    const batches = 12;
    const per = Math.ceil(cells.length / batches);
    const start = performance.now();
    let done = 0;
    const step = (now: number): void => {
      const due = Math.min(batches, Math.floor((now - start) / 42) + 1);
      for (; done < due; done++) for (const k of cells.slice(done * per, (done + 1) * per)) gone.add(k);
      if (done < batches) {
        redraw();
        requestAnimationFrame(step);
      } else canvas.remove();
    };
    requestAnimationFrame(step);
  }

  const off = store.on((state, previous) => {
    if (state.all !== previous.all) paintCount();
    if (previous.mode === "loading" && state.mode !== "loading") {
      off();
      window.setTimeout(cut, 420);
    }
  });
  // Never hold the page for long, whatever the network does.
  window.setTimeout(cut, 1600);
  canvas.addEventListener("pointerdown", cut);
  addEventListener("keydown", cut, { once: true });
}
