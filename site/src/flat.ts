import { position } from "./catalogue";
import { drawInsert, drawSpine, ensureFonts } from "./covers";
import type { State, Store } from "./state";

/**
 * The flat rack: the same selection without WebGL. The current case's insert is drawn
 * to a canvas and shown flat; neighbours appear as spines either side. Keyboard and
 * pointer behave as on the stage. This is also what reduced-motion visitors get when
 * the GPU path is unavailable.
 */
export function mountFlat(root: HTMLElement, store: Store): void {
  root.hidden = false;
  root.innerHTML = `
    <div class="flat">
      <button class="flat__turn flat__turn--prev" type="button" aria-label="Previous case">←</button>
      <div class="flat__shelf" data-shelf></div>
      <button class="flat__turn flat__turn--next" type="button" aria-label="Next case">→</button>
    </div>`;
  const shelf = root.querySelector<HTMLElement>("[data-shelf]")!;
  root.querySelector(".flat__turn--prev")!.addEventListener("click", () => store.step(-1, "keys"));
  root.querySelector(".flat__turn--next")!.addEventListener("click", () => store.step(1, "keys"));

  const style = document.createElement("style");
  style.textContent = `
    .flat { position: absolute; inset: 0; display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; }
    .flat__turn { font: 500 18px/1 var(--mono); min-height: 44px; color: var(--ink-muted); }
    .flat__turn:hover { color: var(--ink); }
    .flat__shelf { display: flex; align-items: center; justify-content: center; gap: 6px; height: 100%; padding: 96px 0 220px; }
    .flat__spine { height: 52%; width: 22px; border-radius: 1px; cursor: pointer; border: 0; padding: 0; }
    .flat__cover { height: 58%; aspect-ratio: 135 / 190; display: block; box-shadow: 0 22px 30px -18px rgba(58,42,18,.45); cursor: pointer; border: 0; padding: 0; background: none; margin: 0 10px; }
    .flat__cover canvas { width: 100%; height: 100%; display: block; }
    @media (max-width: 1023px) { .flat__shelf { padding: 96px 0 24px; } }
  `;
  root.appendChild(style);

  let painting = false;
  let queued = false;
  async function render(_requested: State): Promise<void> {
    if (painting) {
      queued = true;
      return;
    }
    painting = true;
    await ensureFonts();
    painting = false;
    const state = store.state;
    const frag = document.createDocumentFragment();
    const cur = state.current;
    const around = 4;
    for (let i = Math.max(0, cur - around); i <= Math.min(state.visible.length - 1, cur + around); i++) {
      const entry = state.visible[i];
      if (i === cur) {
        const btn = document.createElement("button");
        btn.className = "flat__cover";
        btn.type = "button";
        btn.setAttribute("aria-label", `${position(i, state.visible.length)} ${entry.title}: open the case`);
        btn.appendChild(drawInsert(entry, 540));
        btn.addEventListener("click", () => (state.mode === "open" ? store.close() : store.open()));
        frag.appendChild(btn);
      } else {
        const btn = document.createElement("button");
        btn.className = "flat__spine";
        btn.type = "button";
        btn.setAttribute("aria-label", `${position(i, state.visible.length)} ${entry.name}`);
        const c = drawSpine(entry, 44);
        c.style.cssText = "width:100%;height:100%;display:block";
        btn.appendChild(c);
        btn.addEventListener("click", () => store.select(i, "drag"));
        frag.appendChild(btn);
      }
    }
    shelf.replaceChildren(frag);
    if (state.mode === "browsing") store.settle();
    if (queued) {
      queued = false;
      void render(store.state);
    }
  }

  window.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT")) return;
    if (e.key === "ArrowRight") store.step(1, "keys");
    else if (e.key === "ArrowLeft") store.step(-1, "keys");
    else if (e.key === "Enter" && !(t && t.tagName === "BUTTON")) store.open();
    else if (e.key === "Escape") store.close();
  });

  store.on((state, previous) => {
    if (state.visible !== previous.visible || state.current !== previous.current || state.mode !== previous.mode) void render(state);
  });
  void render(store.state);
}
