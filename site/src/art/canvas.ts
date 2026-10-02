/**
 * Canvas helpers that work both on the page and in a worker (src/art/worker.ts), so the
 * generators can run off the main thread where OffscreenCanvas exists, and on it where not.
 */

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): AnyCanvas {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  }
  return new OffscreenCanvas(W, H);
}

export function context(c: AnyCanvas, readback = false): Ctx2D {
  const ctx = c.getContext("2d", readback ? { willReadFrequently: true } : undefined) as Ctx2D | null;
  if (!ctx) throw new Error("2D canvas unavailable");
  return ctx;
}
