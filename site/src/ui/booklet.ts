import { dateLine, position } from "../catalogue";
import { fetchReadme, renderReadme } from "../readme";
import type { State, Store } from "../state";

/**
 * The spread: the open case as a panel, with the README as real text. A header carries the
 * position and the title; a row of facts and the description follow, then the README.
 * Focus moves to Close and returns on close.
 */
export function mountBooklet(root: HTMLElement, store: Store): void {
  const sheet = root.querySelector<HTMLElement>("[data-booklet-sheet]")!;
  const no = root.querySelector<HTMLElement>("[data-booklet-no]")!;
  const title = root.querySelector<HTMLElement>("[data-booklet-title]")!;
  const desc = root.querySelector<HTMLElement>("[data-booklet-desc]")!;
  const meta = root.querySelector<HTMLElement>("[data-booklet-meta]")!;
  const link = root.querySelector<HTMLAnchorElement>("[data-booklet-link]")!;
  const close = root.querySelector<HTMLButtonElement>("[data-booklet-close]")!;
  const body = root.querySelector<HTMLElement>("[data-booklet-body]")!;
  let returnFocus: HTMLElement | null = null;
  let token = 0;
  let leaving = 0;

  close.addEventListener("click", () => store.close());
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      store.close();
    }
  });

  async function load(state: State): Promise<void> {
    const entry = state.current >= 0 ? state.visible[state.current] : null;
    if (!entry) return;
    const mine = ++token;
    body.innerHTML = `<p class="spread__state">Fetching the README from GitHub</p>`;
    store.setReadme(entry.name, "loading");
    const text = await fetchReadme(entry);
    if (mine !== token) return; // a newer open superseded this one
    if (text === null) {
      body.innerHTML = `<p class="spread__state spread__state--error">This case has no README on GitHub yet. <a href="${entry.html_url}" target="_blank" rel="noopener">Open the repository</a> to see its files.</p>`;
      store.setReadme(entry.name, "missing");
      return;
    }
    try {
      body.innerHTML = `<article class="readme">${renderReadme(entry, text)}</article>`;
      store.setReadme(entry.name, "ready");
    } catch {
      body.innerHTML = `<p class="spread__state spread__state--error">The README could not be rendered. <a href="${entry.html_url}#readme" target="_blank" rel="noopener">Read it on GitHub</a>.</p>`;
      store.setReadme(entry.name, "error");
    }
  }

  function fact(label: string, value: string): string {
    return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  }

  function show(state: State): void {
    const entry = state.current >= 0 ? state.visible[state.current] : null;
    if (!entry) return;
    clearTimeout(leaving);
    no.textContent = position(state.current, state.visible.length);
    title.textContent = entry.title;
    desc.textContent = entry.description?.trim() || "No description on GitHub yet.";
    meta.innerHTML = [
      fact("Language", entry.language ?? "None"),
      fact("Updated", dateLine(entry.pushed_at || entry.created_at)),
      fact("Started", dateLine(entry.created_at)),
      fact("Stars", String(entry.stargazers_count)),
    ].join("");
    link.href = entry.html_url;
    if (root.hidden) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.hidden = false;
    root.dataset.phase = "in";
    sheet.scrollTop = 0;
    void load(state);
    requestAnimationFrame(() => close.focus({ preventScroll: true }));
  }

  function hide(state: State): void {
    token++;
    const immediate = state.motion === "reduced";
    root.dataset.phase = "out";
    clearTimeout(leaving);
    leaving = window.setTimeout(() => (root.hidden = true), immediate ? 0 : 260);
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }

  store.on((state, previous) => {
    if (state.mode === "open" && previous.mode !== "open") show(state);
    else if (state.mode !== "open" && previous.mode === "open") hide(state);
    else if (state.mode === "open" && state.current !== previous.current) show(state);
  });
}
