import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/archivo/wdth.css";
import "./fonts.css";
import "./styles.css";
import { loadCatalogue } from "./data";
import { mountFlat } from "./flat";
import { readMotionPreference, storeMotionPreference } from "./motion";
import { createStage } from "./stage";
import { Store } from "./state";
import { mountBooklet } from "./ui/booklet";
import { mountCaption } from "./ui/caption";
import { mountIndex } from "./ui/index-list";

const $ = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
};

const store = new Store(readMotionPreference());
document.body.dataset.motion = store.state.motion;

// Chrome state follows the store: body[data-state], the count, the source line.
const count = $<HTMLElement>("[data-count]");
const source = $<HTMLElement>("[data-source]");
store.on((state, previous) => {
  if (state.mode !== previous.mode) document.body.dataset.state = state.mode;
  if (state.motion !== previous.motion) document.body.dataset.motion = state.motion;
  if (state.renderer !== previous.renderer) document.body.dataset.renderer = state.renderer;
  if (state.all !== previous.all || state.source !== previous.source) {
    count.textContent = state.all.length ? `${state.all.length} items` : "";
    const when = state.generatedAt ? new Date(state.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
    source.textContent =
      state.source === "live" ? "Index read live from GitHub" :
      state.source === "cached" ? `Index from GitHub, cached ${when}` :
      state.source === "snapshot" ? `Index from a snapshot taken ${when}` :
      state.source === "stress" ? "Synthetic review catalogue" : "";
  }
});

// Motion preference control: a visible equivalent of the system setting.
const motionToggle = $<HTMLButtonElement>("[data-motion-toggle]");
function reflectMotion(): void {
  const reduced = store.state.motion === "reduced";
  motionToggle.setAttribute("aria-pressed", String(reduced));
  motionToggle.textContent = reduced ? "Full motion" : "Reduce motion";
}
motionToggle.addEventListener("click", () => {
  const next = store.state.motion === "reduced" ? "full" : "reduced";
  storeMotionPreference(next);
  store.setMotion(next);
  reflectMotion();
});
reflectMotion();

mountIndex($<HTMLElement>(".index"), store);
mountCaption($<HTMLElement>("[data-caption]"), $<HTMLElement>("[data-status]"), store);
mountBooklet($<HTMLElement>("[data-booklet]"), store);

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

const params = new URLSearchParams(location.search);
const forceFlat = params.get("renderer") === "flat";
let stage = null as ReturnType<typeof createStage>;
if (!forceFlat && webglAvailable()) {
  stage = createStage(canvas, field, store);
}
if (stage) {
  store.setRenderer("webgl");
} else {
  canvas.hidden = true;
  store.setRenderer("flat");
  mountFlat(flat, store);
}

loadCatalogue((first) => store.setCatalogue(first.entries, first.source, first.generatedAt))
  .then((c) => {
    if (c.source !== store.state.source || c.entries.length !== store.state.all.length) store.setCatalogue(c.entries, c.source, c.generatedAt);
  })
  .catch(() => {
    if (store.state.all.length === 0) store.fail();
  });
