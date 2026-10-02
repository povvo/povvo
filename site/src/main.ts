import "./styles.css";
import { dateLine } from "./catalogue";
import { type Catalogue, loadCatalogue } from "./data";
import { mountFlat } from "./flat";
import { warmLabel } from "./labels";
import { readMotionPreference, storeMotionPreference } from "./motion";
import { readmeHtml } from "./readme";
import { sound } from "./sound";
import { createStage } from "./stage";
import { Store } from "./state";
import { mountBooklet } from "./ui/booklet";
import { mountBoot } from "./ui/boot";
import { mountCaption } from "./ui/caption";
import { mountFlicker } from "./ui/flicker";
import { mountHero } from "./ui/hero";
import { mountIndex } from "./ui/index-list";

const $ = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
};

const params = new URLSearchParams(location.search);
const review = params.has("review");
const store = new Store(readMotionPreference());
document.body.dataset.motion = store.state.motion;
const stageEl = $<HTMLElement>(".stage");
const boot = mountBoot(stageEl, { minMs: review ? 0 : 900, reduced: store.state.motion === "reduced" });

// Chrome state follows the store: body[data-state], the holdings count, the index source.
const count = $<HTMLElement>("[data-count]");
const tally = $<HTMLElement>("[data-tally]");
const source = $<HTMLElement>("[data-source]");
store.on((state, previous) => {
  if (state.mode !== previous.mode) document.body.dataset.state = state.mode;
  if (state.motion !== previous.motion) document.body.dataset.motion = state.motion;
  if (state.renderer !== previous.renderer) document.body.dataset.renderer = state.renderer;
  if (state.all !== previous.all || state.source !== previous.source) {
    count.textContent = state.all.length ? `${state.all.length} disks` : "—";
    tally.textContent = state.all.length ? `(${state.all.length})` : "";
    const when = state.generatedAt ? dateLine(state.generatedAt) : "";
    source.textContent =
      state.source === "live" ? "Live from GitHub" :
      state.source === "cached" ? `GitHub, read ${when}` :
      state.source === "snapshot" ? `Snapshot ${when}` :
      state.source === "stress" ? "Synthetic review set" : "—";
  }
});

// Motion preference control: a visible equivalent of the system setting.
const motionToggle = $<HTMLButtonElement>("[data-motion-toggle]");
function reflectMotion(): void {
  const reduced = store.state.motion === "reduced";
  motionToggle.setAttribute("aria-pressed", String(reduced));
  motionToggle.textContent = reduced ? "Motion off" : "Motion on";
}
motionToggle.addEventListener("click", () => {
  const next = store.state.motion === "reduced" ? "full" : "reduced";
  storeMotionPreference(next);
  store.setMotion(next);
  reflectMotion();
});
reflectMotion();

// Sound control: off until asked for.
const soundToggle = $<HTMLButtonElement>("[data-sound-toggle]");
function reflectSound(): void {
  soundToggle.setAttribute("aria-pressed", String(sound.on));
  soundToggle.textContent = sound.on ? "Sound on" : "Sound off";
}
soundToggle.addEventListener("click", () => {
  sound.set(!sound.on);
  reflectSound();
});
reflectSound();

mountIndex($<HTMLElement>("[data-index]"), $<HTMLElement>("[data-index-open]"), store);
mountCaption($<HTMLElement>("[data-caption]"), $<HTMLElement>("[data-turn]"), $<HTMLElement>("[data-status]"), store);
mountBooklet($<HTMLElement>("[data-booklet]"), store);
mountHero($<HTMLElement>("[data-hero]"), stageEl, store);
mountFlicker(store);

const canvas = $<HTMLCanvasElement>("#rack");
const field = $<HTMLElement>("[data-field]");
const flat = $<HTMLElement>("[data-flat]");

function webglAvailable(): boolean {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

const forceFlat = params.get("renderer") === "flat";
let stage = null as ReturnType<typeof createStage>;
if (!forceFlat && webglAvailable()) stage = createStage(canvas, field, store);
if (stage) store.setRenderer("webgl");
else {
  canvas.hidden = true;
  store.setRenderer("flat");
  mountFlat(flat, store);
}

// ---------- links: #/name selects a disk, #/name/readme opens it ----------
function fromHash(): { name: string; open: boolean } | null {
  const m = /^#\/([^/]+)(\/readme)?$/.exec(location.hash);
  return m ? { name: decodeURIComponent(m[1]), open: Boolean(m[2]) } : null;
}
let openWhenSettled = false;
function applyHash(): void {
  const want = fromHash();
  if (!want) return;
  const i = store.state.visible.findIndex((e) => e.name === want.name);
  if (i < 0) return;
  if (i !== store.state.current) {
    store.select(i, "index");
    openWhenSettled = want.open;
    return;
  }
  // Already on that disk: act now, or once it settles, and never carry the wish to another disk.
  openWhenSettled = false;
  if (want.open && store.state.mode === "settled" && !document.body.dataset.boot) store.open();
  else if (want.open && store.state.mode !== "open") openWhenSettled = true;
  else if (!want.open && store.state.mode === "open") store.close();
}
addEventListener("hashchange", applyHash);
store.on((state, previous) => {
  if (state.mode === previous.mode && state.current === previous.current) return;
  const e = store.current;
  if (!e) return;
  if (state.mode === "settled" || state.mode === "open") {
    const hash = `#/${encodeURIComponent(e.name)}${state.mode === "open" ? "/readme" : ""}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    document.title = `${e.title} — Ethan Lee Barrett`;
  }
  if (state.mode === "settled" && openWhenSettled && !document.body.dataset.boot) {
    openWhenSettled = false;
    store.open();
  }
});

// ---------- prefetch: the settled disk's README and its neighbours', while idle ----------
const idle = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
store.on((state, previous) => {
  if (state.mode !== "settled" || previous.mode === "settled") return;
  const i = state.current;
  idle(() => {
    for (const k of [i, i + 1, i - 1]) {
      const e = state.visible[k];
      if (e) void readmeHtml(e).catch(() => undefined);
    }
  });
});

// ---------- catalogue and boot ----------
let ready: () => void = () => {};
const first = new Promise<void>((r) => (ready = r));
let seen = false;
// The first catalogue to arrive opens the boot, whether it came early (cache, snapshot) or only
// with the live read.
function firstCatalogue(c: Catalogue): void {
  seen = true;
  performance.mark("boot:catalogue");
  store.setCatalogue(c.entries, c.source, c.generatedAt);
  applyHash();
  ready();
}
loadCatalogue(firstCatalogue)
  .then((c) => {
    if (!seen) firstCatalogue(c);
    else if (c.source !== store.state.source || c.entries.length !== store.state.all.length) store.setCatalogue(c.entries, c.source, c.generatedAt);
  })
  .catch(() => {
    if (store.state.all.length === 0) store.fail();
    ready();
  });

void (async () => {
  await first;
  const current = store.current;
  if (current) {
    boot.setCurrent(current);
    const warm = stage
      ? stage.warm(boot.progress)
      : (async () => {
          // The flat box draws the current disk large and two either side.
          const near = [-2, -1, 1, 2].map((d) => store.state.visible[store.state.current + d]).filter(Boolean);
          const total = near.length + 1;
          boot.progress(0, total, current);
          await warmLabel(current, 512, 0);
          let done = 1;
          boot.progress(done, total, current);
          await Promise.all(near.map((e) => warmLabel(e, 224, 2).then(() => boot.progress(++done, total, e))));
        })();
    // A failed warm-up only costs the head start; it never holds the page behind the boot.
    await Promise.race([warm.catch(() => undefined), boot.skipped]);
  }
  performance.mark("boot:warm");
  await boot.finish(() => stage?.arrive());
  performance.mark("boot:done");
  if (openWhenSettled && store.state.mode === "settled") {
    openWhenSettled = false;
    store.open();
  }
})();

// ---------- offline: the service worker keeps the app shell and the snapshot ----------
if (import.meta.env.PROD && "serviceWorker" in navigator && !review) {
  addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // What this visit loaded before the worker was in control, for it to keep.
        const loaded = performance.getEntriesByType("resource").map((r) => r.name);
        reg.active?.postMessage({ cache: loaded });
      })
      .catch(() => undefined);
  });
}
