import { formatNo, metaLine } from "../catalogue";
import type { State, Store } from "../state";

/**
 * The caption is the current case in words. Feedback and result are separate moments:
 * the number updates as soon as the selection moves; the title, description and meta
 * swap when the rack has settled and the case is out. Under reduced motion both are
 * immediate. The status region announces the settled case for assistive technology.
 */
export function mountCaption(root: HTMLElement, status: HTMLElement, store: Store): void {
  const no = root.querySelector<HTMLElement>("[data-no]")!;
  const title = root.querySelector<HTMLElement>("[data-title]")!;
  const desc = root.querySelector<HTMLElement>("[data-desc]")!;
  const meta = root.querySelector<HTMLElement>("[data-meta]")!;
  const open = root.querySelector<HTMLButtonElement>("[data-open]")!;
  let shownName: string | null = null;

  open.addEventListener("click", () => store.open());

  function swap(state: State): void {
    const entry = state.current >= 0 ? state.visible[state.current] : null;
    if (!entry) return;
    if (shownName === entry.name) return;
    shownName = entry.name;
    title.textContent = entry.title;
    desc.textContent = entry.description ?? "";
    meta.textContent = metaLine(entry);
    root.dataset.swap = "in";
    status.textContent = `${formatNo(entry.no)}, ${entry.title}. ${entry.description ?? "No description."} ${metaLine(entry)}.`;
  }

  function render(state: State, previous: State): void {
    const entry = state.current >= 0 ? state.visible[state.current] : null;
    if (state.mode === "loading") {
      no.textContent = "";
      title.textContent = "Loading the catalogue";
      desc.textContent = "";
      meta.textContent = "";
      open.hidden = true;
      return;
    }
    if (state.mode === "failed" || !entry) {
      no.textContent = "";
      title.textContent = state.mode === "failed" ? "The catalogue could not be reached" : "Nothing matches";
      desc.textContent = state.mode === "failed" ? "GitHub did not answer and no snapshot was available. The repositories are still at github.com/povvo." : "";
      meta.textContent = "";
      open.hidden = true;
      return;
    }
    no.textContent = `${formatNo(entry.no)} of ${state.all.length}`;
    open.hidden = false;
    open.textContent = state.mode === "open" ? "Close the case" : "Open the case";
    open.onclick = () => (state.mode === "open" ? store.close() : store.open());

    const immediate = state.motion === "reduced" || state.renderer === "flat";
    if (immediate || state.mode === "settled" || state.mode === "open") {
      swap(state);
    } else if (shownName === null) {
      // Arrival: the rack is still turning into place; the number is the only text.
      title.textContent = "";
      desc.textContent = "";
      meta.textContent = "";
    } else if (state.current !== previous.current && root.dataset.swap !== "out") {
      // The rack is moving: the old title steps aside until the new case is out.
      root.dataset.swap = "out";
    }
  }

  store.on(render);
  render(store.state, store.state);
}
