import { pad2 } from "../catalogue";
import type { State, Store } from "../state";

/**
 * Edge rail: one tick per case along the stage edge, every fifth numbered, and one small hot
 * marker that snaps to the current case (a tiny marker activating a large field). It is a
 * pointer shortcut only; the tracklist is the accessible equivalent.
 */
export function mountRail(root: HTMLElement, store: Store): void {
  let count = -1;
  const marker = document.createElement("li");
  marker.className = "rail__marker";
  const label = document.createElement("span");
  label.className = "rail__label";
  marker.appendChild(label);

  function build(state: State): void {
    const n = state.visible.length;
    count = n;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const li = document.createElement("li");
      li.className = "rail__tick";
      if ((i + 1) % 5 === 0) li.dataset.major = pad2(i + 1, n);
      li.style.setProperty("--at", n > 1 ? String(i / (n - 1)) : "0.5");
      li.addEventListener("click", () => store.select(i, "index"));
      frag.appendChild(li);
    }
    frag.appendChild(marker);
    root.replaceChildren(frag);
  }

  function place(state: State): void {
    const n = state.visible.length;
    if (n !== count) build(state);
    root.hidden = n < 2;
    if (state.current < 0) return;
    marker.style.setProperty("--at", n > 1 ? String(state.current / (n - 1)) : "0.5");
    label.textContent = pad2(state.current + 1, n);
  }

  store.on((state, previous) => {
    if (state.visible !== previous.visible || state.current !== previous.current) place(state);
  });
  place(store.state);
}
