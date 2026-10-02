import { logoBucket, logoCanvas } from "../logo";
import { type Scene, photograph } from "../xerox";
import type { AnyCanvas } from "./canvas";
import { type Job, jobKey } from "./jobs";

/**
 * The art service (recipe/direction-v4.md, loading). Logos and photographs are requested
 * here with a priority; a small pool of workers draws them in priority order, off the main
 * thread, and keeps each drawing in Cache Storage for the next visit. Where workers or
 * OffscreenCanvas are missing, the same generators run on the main thread, one job per
 * macrotask, so the page still yields between them.
 */

export type Pic = ImageBitmap | AnyCanvas;

interface Pending {
  id: number;
  job: Job;
  priority: number;
  seq: number;
  resolve: (p: Pic) => void;
  reject: (e: unknown) => void;
}

const memory = new Map<string, Promise<Pic>>();
const queue: Pending[] = [];
let seq = 0;
let nextId = 1;
const stats = { drawn: 0, cached: 0 };

const canUseWorkers = typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined";
interface Slot {
  worker: Worker;
  busy: Pending | null;
}
let pool: Slot[] | null = null;
let fallback = !canUseWorkers;

function startPool(): Slot[] {
  const size = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
  const slots: Slot[] = [];
  for (let i = 0; i < size; i++) {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    const slot: Slot = { worker, busy: null };
    worker.onmessage = (e: MessageEvent<{ id: number; bitmap?: ImageBitmap; cached?: boolean; error?: string }>) => {
      const job = slot.busy;
      if (!job || job.id !== e.data.id) return;
      slot.busy = null;
      if (e.data.bitmap) {
        if (e.data.cached) stats.cached++;
        else stats.drawn++;
        job.resolve(e.data.bitmap);
      } else runHere(job);
      pump();
    };
    worker.onerror = () => {
      // A worker that cannot start (old browser, blocked module workers) hands everything to the page.
      fallback = true;
      const job = slot.busy;
      slot.busy = null;
      if (job) runHere(job);
      pump();
    };
    slots.push(slot);
  }
  return slots;
}

function runHere(p: Pending): void {
  setTimeout(() => {
    try {
      const pic = p.job.kind === "logo" ? logoCanvas(p.job.text, p.job.height, p.job.ink) : photograph(p.job.seed, p.job.scene, p.job.w, p.job.h);
      stats.drawn++;
      p.resolve(pic);
    } catch (err) {
      p.reject(err);
    }
    pump();
  }, 0);
}

let hereBusy = false;
function pump(): void {
  queue.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
  if (fallback) {
    if (hereBusy || !queue.length) return;
    hereBusy = true;
    const p = queue.shift()!;
    const done = p.resolve;
    const fail = p.reject;
    p.resolve = (pic) => {
      hereBusy = false;
      done(pic);
    };
    p.reject = (e) => {
      hereBusy = false;
      fail(e);
    };
    runHere(p);
    return;
  }
  if (!pool) pool = startPool();
  for (const slot of pool) {
    if (slot.busy || !queue.length) continue;
    const p = queue.shift()!;
    slot.busy = p;
    slot.worker.postMessage({ id: p.id, job: p.job });
  }
}

function request(job: Job, priority: number): Promise<Pic> {
  const key = jobKey(job);
  const hit = memory.get(key);
  if (hit) {
    // A repeat request can raise a queued job's priority.
    const queued = queue.find((q) => jobKey(q.job) === key);
    if (queued && priority < queued.priority) queued.priority = priority;
    return hit;
  }
  const promise = new Promise<Pic>((resolve, reject) => {
    queue.push({ id: nextId++, job, priority, seq: seq++, resolve, reject });
  });
  memory.set(key, promise);
  if (memory.size > 400) memory.delete(memory.keys().next().value as string);
  promise.catch(() => memory.delete(key));
  pump();
  return promise;
}

/** The logo for `text`, `height` device pixels tall, in `ink`. Lower priority runs sooner. */
export function logoArt(text: string, height: number, ink = "#fff", priority = 5): Promise<Pic> {
  return request({ kind: "logo", text, height: logoBucket(height), ink }, priority);
}

export function photoArt(seed: string, scene: Scene, w: number, h: number, priority = 5): Promise<Pic> {
  return request({ kind: "photo", seed, scene, w: Math.round(w), h: Math.round(h) }, priority);
}

/** How many drawings came from the cache and how many were drawn, for the boot screen. */
export function artStats(): { drawn: number; cached: number } {
  return { ...stats };
}

/** Draw `pic` fitted inside the box and centred in it. */
export function drawFitted(ctx: CanvasRenderingContext2D, pic: Pic, x: number, y: number, w: number, h: number): void {
  const k = Math.min(w / pic.width, h / pic.height);
  const dw = pic.width * k;
  const dh = pic.height * k;
  ctx.drawImage(pic, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
