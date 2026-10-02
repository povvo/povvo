import { position } from "./catalogue";
import { diskCanvas } from "./labels";
import type { State, Store } from "./state";

/**
 * The flat box: the same selection without WebGL. The current disk is drawn flat and large;
 * two neighbours either side stand smaller and dimmer. Keyboard and pointer behave as on the
 * stage. This is also what reduced-motion visitors get when the GPU path is unavailable.
 */
export function mountFlat(root: HTMLElement, store: Store): void {
  root.hidden = false;
  root.innerHTML = `
    <div class="flat">
      <button class="flat__turn flat__turn--prev" type="button" aria-label="Previous disk">←</button>
      <div class="flat__shelf" data-shelf></div>
      <button class="flat__turn flat__turn--next" type="button" aria-label="Next disk">→</button>
    </div>`;
  const shelf = root.querySelector<HTMLElement>("[data-shelf]")!;
  root.querySelector(".flat__turn--prev")!.addEventListener("click", () => store.step(-1, "keys"));
  root.querySelector(".flat__turn--next")!.addEventListener("click", () => store.step(1, "keys"));

  const style = document.createElement("style");
  style.textContent = `
    .flat { position: absolute; inset: 0; display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; }
    .flat__turn { font: 400 18px/1 var(--sans); min-height: 44px; color: var(--grey); }
    .flat__turn:hover { color: var(--ink); }
    .flat__turn--next { grid-column: 3; }
    /* Below the logo, which holds the top of the stage. */
    .flat__shelf { position: absolute; left: 44px; right: 44px; top: 36%; bottom: 10%; display: flex; align-items: center; justify-content: center; gap: 14px; }
    .flat__disk { height: 100%; aspect-ratio: 90 / 94; display: block; cursor: pointer; border: 0; padding: 0; background: none; transition: transform 200ms ease; }
    .flat__disk:hover { transform: translateY(-4px); }
    .flat__disk canvas { width: 100%; height: 100%; display: block; }
    .flat__disk--side { height: 54%; opacity: 0.45; }
    .flat__disk--far { height: 40%; opacity: 0.22; }
    @media (max-width: 1023px) { .flat__shelf { top: 32%; bottom: 4%; gap: 8px; } .flat__disk--far { display: none; } }
  `;
  root.appendChild(style);

  // Recently drawn disks, oldest first: enough for the view and a little history, since a
  // full-size disk is close to 2 MB of canvas. A drawing that fails is dropped to be retried.
  const KEEP = 24;
  const drawn = new Map<string, Promise<HTMLCanvasElement>>();
  function disk(state: State, i: number, w: number): Promise<HTMLCanvasElement> {
    const e = state.visible[i];
    const key = `${e.name}@${w}`;
    let c = drawn.get(key);
    if (c) drawn.delete(key);
    else {
      c = diskCanvas(e, w, Math.abs(i - state.current));
      c.catch(() => drawn.delete(key));
    }
    drawn.set(key, c);
    while (drawn.size > KEEP) drawn.delete(drawn.keys().next().value as string);
    return c;
  }

  let token = 0;
  async function render(): Promise<void> {
    const mine = ++token;
    const state = store.state;
    const cur = state.current;
    if (cur < 0) return;
    const items: { i: number; cls: string; w: number }[] = [];
    for (let i = Math.max(0, cur - 2); i <= Math.min(state.visible.length - 1, cur + 2); i++) {
      const d = Math.abs(i - cur);
      items.push({ i, cls: d === 0 ? "" : d === 1 ? "flat__disk--side" : "flat__disk--far", w: d === 0 ? 640 : 280 });
    }
    let canvases: HTMLCanvasElement[];
    try {
      canvases = await Promise.all(items.map((it) => disk(state, it.i, it.w)));
    } catch {
      return; // the failed drawing was dropped; the next selection draws it again
    }
    if (mine !== token) return;
    const frag = document.createDocumentFragment();
    items.forEach((it, k) => {
      const entry = state.visible[it.i];
      const btn = document.createElement("button");
      btn.className = `flat__disk ${it.cls}`;
      btn.type = "button";
      btn.setAttribute("aria-label", it.i === cur ? `${position(it.i, state.visible.length)} ${entry.title}: open the disk` : `${position(it.i, state.visible.length)} ${entry.title}`);
      const c = document.createElement("canvas");
      c.width = canvases[k].width;
      c.height = canvases[k].height;
      c.getContext("2d")!.drawImage(canvases[k], 0, 0);
      btn.appendChild(c);
      btn.addEventListener("click", () => (it.i === cur ? (store.state.mode === "open" ? store.close() : store.open()) : store.select(it.i, "drag")));
      frag.appendChild(btn);
    });
    shelf.replaceChildren(frag);
    if (store.state.mode === "browsing") store.settle();
  }

  window.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT")) return;
    if (document.body.dataset.index === "open" || document.body.dataset.boot) return;
    if (e.key === "ArrowRight") store.step(1, "keys");
    else if (e.key === "ArrowLeft") store.step(-1, "keys");
    else if (e.key === "Enter" && !(t && t.tagName === "BUTTON")) store.open();
    else if (e.key === "Escape") store.close();
  });

  store.on((state, previous) => {
    if (state.visible !== previous.visible || state.current !== previous.current || state.mode !== previous.mode) void render();
  });
  void render();
}
