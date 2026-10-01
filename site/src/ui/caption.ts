import { metaLine, position } from "../catalogue";
import type { State, Store } from "../state";

/**
 * The caption is the case out of the rack, set as a specimen label. Feedback and result are
 * separate moments: the position updates as soon as the selection moves; the capsule code,
 * standfirst and meta scan in once the rack has settled and the case is out. Under reduced
 * motion both are immediate. The status region announces the settled case.
 * The callout label decodes the capsule code printed on the cover.
 */
export function mountCaption(root: HTMLElement, status: HTMLElement, calloutLabel: HTMLElement, store: Store): void {
  const no = root.querySelector<HTMLElement>("[data-no]")!;
  const code = root.querySelector<HTMLElement>("[data-code]")!;
  const title = root.querySelector<HTMLElement>("[data-title]")!;
  const desc = root.querySelector<HTMLElement>("[data-desc]")!;
  const meta = root.querySelector<HTMLElement>("[data-meta]")!;
  const open = root.querySelector<HTMLButtonElement>("[data-open]")!;
  let shownName: string | null = null;

  open.addEventListener("click", () => (store.state.mode === "open" ? store.close() : store.open()));

  function swap(state: State): void {
    const entry = state.current >= 0 ? state.visible[state.current] : null;
    if (!entry || shownName === entry.name) {
      if (entry) root.dataset.swap = "in";
      return;
    }
    shownName = entry.name;
    code.textContent = entry.capsule;
    title.textContent = entry.title;
    desc.textContent = entry.description?.trim() || "No description on GitHub yet. The README is inside.";
    meta.textContent = metaLine(entry);
    const [, lang, year] = entry.capsule.split("-");
    calloutLabel.innerHTML = `<span>${entry.capsule} · Vol. ${String(entry.no).padStart(2, "0")}</span><span>${lang === "DOC" ? "Documents" : entry.language ?? lang} · 20${year}</span>`;
    root.dataset.swap = "off";
    void root.offsetWidth;
    root.dataset.swap = "in";
    status.textContent = `${position(state.current, state.visible.length)}. ${entry.title}. ${entry.description ?? "No description."} ${metaLine(entry)}.`;
  }

  function render(state: State, previous: State): void {
    const entry = state.current >= 0 ? state.visible[state.current] : null;
    if (state.mode === "loading") {
      no.textContent = "";
      desc.textContent = "Loading the catalogue";
      open.hidden = true;
      return;
    }
    if (state.mode === "failed" || !entry) {
      no.textContent = "";
      code.textContent = "ELB";
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
    open.innerHTML = state.mode === "open" ? 'Close the case <span aria-hidden="true">Esc</span>' : 'Open the case <span aria-hidden="true">↵</span>';

    const immediate = state.motion === "reduced" || state.renderer === "flat";
    if (immediate || state.mode === "settled" || state.mode === "open") swap(state);
    else if (state.current !== previous.current || state.selectionTick !== previous.selectionTick) {
      // The rack is moving: the old label steps aside until the new case is out.
      if (shownName !== null) root.dataset.swap = "out";
      shownName = null;
    }
  }

  store.on(render);
  render(store.state, store.state);
}
