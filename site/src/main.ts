import "./styles.css";
import { dateLine } from "./catalogue";
import { loadCatalogue } from "./data";
import { mountFlat } from "./flat";
import { readMotionPreference, storeMotionPreference } from "./motion";
import { createStage } from "./stage";
import { Store } from "./state";
import { mountBooklet } from "./ui/booklet";
import { mountCaption } from "./ui/caption";
import { mountFlicker } from "./ui/flicker";
import { mountHero } from "./ui/hero";
import { mountIndex } from "./ui/index-list";

const $ = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
};

const store = new Store(readMotionPreference());
document.body.dataset.motion = store.state.motion;

// Chrome state follows the store: body[data-state], the holdings count, the index source.
const count = $<HTMLElement>("[data-count]");
const tally = $<HTMLElement>("[data-tally]");
const source = $<HTMLElement>("[data-source]");
store.on((state, previous) => {
  if (state.mode !== previous.mode) document.body.dataset.state = state.mode;
  if (state.motion !== previous.motion) document.body.dataset.motion = state.motion;
  if (state.renderer !== previous.renderer) document.body.dataset.renderer = state.renderer;
  if (state.all !== previous.all || state.source !== previous.source) {
    count.textContent = state.all.length ? `${state.all.length} projects` : "—";
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

mountIndex($<HTMLElement>("[data-index]"), $<HTMLElement>("[data-index-open]"), store);
mountCaption($<HTMLElement>("[data-caption]"), $<HTMLElement>("[data-turn]"), $<HTMLElement>("[data-status]"), store);
mountBooklet($<HTMLElement>("[data-booklet]"), store);
mountHero($<HTMLElement>("[data-hero]"), $<HTMLElement>(".stage"), store);
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
