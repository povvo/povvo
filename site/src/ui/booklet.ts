import { dateLine, position, shellOf, SIGNAL } from "../catalogue";
import { drawSlab } from "../covers";
import { fetchReadme, renderReadme } from "../readme";
import type { State, Store } from "../state";

/**
 * The spread: the open case as a feature, with the README as real text. A slab in the case
 * colour carries the title; a protocol row carries the facts; the standfirst is the voice;
 * the README follows. Focus moves to Close and returns on close.
 */
export function mountBooklet(root: HTMLElement, store: Store): void {
  const sheet = root.querySelector<HTMLElement>("[data-booklet-sheet]")!;
  const code = root.querySelector<HTMLElement>("[data-booklet-code]")!;
  const no = root.querySelector<HTMLElement>("[data-booklet-no]")!;
  const title = root.querySelector<HTMLElement>("[data-booklet-title]")!;
  const desc = root.querySelector<HTMLElement>("[data-booklet-desc]")!;
  const meta = root.querySelector<HTMLElement>("[data-booklet-meta]")!;
  const link = root.querySelector<HTMLAnchorElement>("[data-booklet-link]")!;
  const close = root.querySelector<HTMLButtonElement>("[data-booklet-close]")!;
  const body = root.querySelector<HTMLElement>("[data-booklet-body]")!;
  const quilt = root.querySelector<HTMLElement>("[data-booklet-quilt]")!;
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
    const shell = shellOf(entry);
    root.style.setProperty("--slab", shell.hex);
    root.style.setProperty("--slab-text", shell.text);
    root.style.setProperty("--slab-accent", entry.layout === "specimen" ? SIGNAL : shell.accent);
    code.textContent = entry.capsule;
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
    // The slab's patchwork comes from the same seed family as the case's cover; it is drawn
    // after the spread is shown so it can be sized to the slab.
    const rect = quilt.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const art = drawSlab(entry, Math.max(320, Math.round(rect.width * dpr)), Math.max(200, Math.round(rect.height * dpr)));
    art.className = "spread__quilt-art";
    quilt.replaceChildren(art);
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
