import { metaLine, position } from "../catalogue";
import type { State, Store } from "../state";

/**
 * The caption is the disk out of the box, typeset on the grid with no box around it. Feedback
 * and result are separate moments: the position updates as soon as the selection moves; the
 * code, standfirst and meta rise into place once the rack has settled and the case is out.
 * Under reduced motion both are immediate. The status region announces the settled case.
 * The right-hand column names the neighbours and turns to them.
 */
export function mountCaption(root: HTMLElement, turn: HTMLElement, status: HTMLElement, store: Store): void {
  const no = root.querySelector<HTMLElement>("[data-no]")!;
  const title = root.querySelector<HTMLElement>("[data-title]")!;
  const desc = root.querySelector<HTMLElement>("[data-desc]")!;
  const meta = root.querySelector<HTMLElement>("[data-meta]")!;
  const open = root.querySelector<HTMLButtonElement>("[data-open]")!;
  const prev = turn.querySelector<HTMLButtonElement>("[data-prev]")!;
  const next = turn.querySelector<HTMLButtonElement>("[data-next]")!;
  const prevName = turn.querySelector<HTMLElement>("[data-prev-name]")!;
  const nextName = turn.querySelector<HTMLElement>("[data-next-name]")!;
  let shownName: string | null = null;

  open.addEventListener("click", () => (store.state.mode === "open" ? store.close() : store.open()));
  prev.addEventListener("click", () => store.step(-1, "keys"));
  next.addEventListener("click", () => store.step(1, "keys"));

  function neighbours(state: State): void {
    const before = state.current > 0 ? state.visible[state.current - 1] : null;
    const after = state.current >= 0 && state.current < state.visible.length - 1 ? state.visible[state.current + 1] : null;
    prev.hidden = !before;
    next.hidden = !after;
    prevName.textContent = before?.title ?? "";
    nextName.textContent = after?.title ?? "";
    prev.setAttribute("aria-label", before ? `Previous: ${before.title}` : "Previous");
    next.setAttribute("aria-label", after ? `Next: ${after.title}` : "Next");
  }

  function swap(state: State): void {
    const entry = state.current >= 0 ? state.visible[state.current] : null;
    if (!entry || shownName === entry.name) {
      if (entry) root.dataset.swap = "in";
      return;
    }
    shownName = entry.name;
    title.textContent = entry.title;
    desc.textContent = entry.description?.trim() || "No description on GitHub yet. The README is on the disk.";
    meta.textContent = metaLine(entry);
    root.dataset.swap = "off";
    void root.offsetWidth;
    root.dataset.swap = "in";
    status.textContent = `${position(state.current, state.visible.length)}. ${entry.title}. ${entry.description ?? "No description."} ${metaLine(entry)}.`;
  }

  function render(state: State, previous: State): void {
    const entry = state.current >= 0 ? state.visible[state.current] : null;
    neighbours(state);
    if (state.mode === "loading") {
      no.textContent = "";
      title.textContent = "Loading the catalogue";
      desc.textContent = "";
      open.hidden = true;
      return;
    }
    if (state.mode === "failed" || !entry) {
      no.textContent = "";
      title.textContent = state.mode === "failed" ? "The catalogue could not be reached" : "Nothing matches";
      desc.textContent = state.mode === "failed" ? "GitHub did not answer and no snapshot was available. The repositories are still at github.com/povvo." : "Nothing in the catalogue matches that search.";
      meta.textContent = "";
      open.hidden = true;
      shownName = null;
      root.dataset.swap = "in";
      return;
    }
    no.textContent = position(state.current, state.visible.length);
    open.hidden = false;
    open.innerHTML = state.mode === "open" ? '<span class="caption__label">Eject the disk</span> <kbd aria-hidden="true">Esc</kbd>' : '<span class="caption__label">Read the disk</span> <kbd aria-hidden="true">↵</kbd>';

    const immediate = state.motion === "reduced" || state.renderer === "flat";
    if (immediate || state.mode === "settled" || state.mode === "open") swap(state);
    else if (state.current !== previous.current || state.selectionTick !== previous.selectionTick) {
      // The rack is moving: the old words fade out until the new case is out.
      if (shownName !== null) root.dataset.swap = "out";
      shownName = null;
    }
  }

  store.on(render);
  render(store.state, store.state);
}
