import { formatNo, metaLine } from "../catalogue";
import { markAngle } from "../covers";
import { fetchReadme, renderReadme } from "../readme";
import type { State, Store } from "../state";

/** The booklet: the README as real text, over the index column. */
export function mountBooklet(root: HTMLElement, store: Store): void {
  const no = root.querySelector<HTMLElement>("[data-booklet-no]")!;
  const title = root.querySelector<HTMLElement>("[data-booklet-title]")!;
  const desc = root.querySelector<HTMLElement>("[data-booklet-desc]")!;
  const meta = root.querySelector<HTMLElement>("[data-booklet-meta]")!;
  const link = root.querySelector<HTMLAnchorElement>("[data-booklet-link]")!;
  const close = root.querySelector<HTMLButtonElement>("[data-booklet-close]")!;
  const body = root.querySelector<HTMLElement>("[data-booklet-body]")!;
  const dot = root.querySelector<SVGCircleElement>(".booklet__mark-dot")!;
  let returnFocus: HTMLElement | null = null;
  let token = 0;

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
    body.innerHTML = `<p class="booklet__loading">Fetching the README from GitHub</p>`;
    store.setReadme(entry.name, "loading");
    const text = await fetchReadme(entry);
    if (mine !== token) return; // a newer open superseded this one
    if (text === null) {
      body.innerHTML = `<p class="booklet__error">This case has no README on GitHub yet. <a href="${entry.html_url}" target="_blank" rel="noopener">Open the repository</a> to see its files.</p>`;
      store.setReadme(entry.name, "missing");
      return;
    }
    try {
      body.innerHTML = `<article class="readme">${renderReadme(entry, text)}</article>`;
      store.setReadme(entry.name, "ready");
    } catch {
      body.innerHTML = `<p class="booklet__error">The README could not be rendered. <a href="${entry.html_url}#readme" target="_blank" rel="noopener">Read it on GitHub</a>.</p>`;
      store.setReadme(entry.name, "error");
    }
  }

  function show(state: State): void {
    const entry = state.current >= 0 ? state.visible[state.current] : null;
    if (!entry) return;
    no.textContent = formatNo(entry.no);
    title.textContent = entry.title;
    desc.textContent = entry.description ?? "";
    meta.textContent = metaLine(entry);
    link.href = entry.html_url;
    const a = markAngle(entry, Math.max(1, state.all.length));
    dot.setAttribute("cx", String(24 + Math.cos(a) * 17));
    dot.setAttribute("cy", String(24 + Math.sin(a) * 17));
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.hidden = false;
    body.scrollTop = 0;
    void load(state);
    requestAnimationFrame(() => close.focus({ preventScroll: true }));
  }

  function hide(): void {
    token++;
    root.hidden = true;
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }

  store.on((state, previous) => {
    if (state.mode === "open" && previous.mode !== "open") show(state);
    else if (state.mode !== "open" && previous.mode === "open") hide();
    else if (state.mode === "open" && state.current !== previous.current) show(state);
  });
}
