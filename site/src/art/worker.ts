import { logoCanvas } from "../logo";
import { photograph } from "../xerox";
import { CACHE_NAME, type Job, jobKey } from "./jobs";

/**
 * Draws logos and photographs off the main thread, on OffscreenCanvas, so generating art
 * never drops a frame. Each drawing is kept in Cache Storage (as WebP where the browser can
 * encode it), so a second visit decodes instead of drawing. Older generator versions' caches
 * are deleted on start.
 */
// The page's DOM typings are in scope; the worker needs only these of its own globals.
declare const self: {
  onmessage: ((e: MessageEvent<{ id: number; job: Job }>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  location: { origin: string };
};

let cache: Promise<Cache | null> | null = null;
function openCache(): Promise<Cache | null> {
  if (!cache) {
    cache = (async () => {
      try {
        if (!("caches" in self)) return null;
        for (const name of await caches.keys()) if (name.startsWith("elb-art-") && name !== CACHE_NAME) await caches.delete(name);
        return await caches.open(CACHE_NAME);
      } catch {
        return null;
      }
    })();
  }
  return cache;
}

self.onmessage = async (e: MessageEvent<{ id: number; job: Job }>) => {
  const { id, job } = e.data;
  try {
    const store = await openCache();
    const url = `${self.location.origin}/__art/${jobKey(job)}`;
    if (store) {
      const hit = await store.match(url).catch(() => undefined);
      if (hit) {
        const bitmap = await createImageBitmap(await hit.blob());
        self.postMessage({ id, bitmap, cached: true }, [bitmap]);
        return;
      }
    }
    const canvas = (job.kind === "logo" ? logoCanvas(job.text, job.height, job.ink) : photograph(job.seed, job.scene, job.w, job.h)) as OffscreenCanvas;
    const bitmap = await createImageBitmap(canvas);
    self.postMessage({ id, bitmap, cached: false }, [bitmap]);
    if (store) {
      const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.95 });
      await store.put(url, new Response(blob, { headers: { "content-type": blob.type } })).catch(() => undefined);
    }
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
