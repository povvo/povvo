import { SIGNAL, shellOf } from "../catalogue";
import { ensureFonts, fitTitle } from "../covers";
import type { State, Store } from "../state";

/**
 * The giant title behind the case (signature pattern: type behind the object). It belongs to
 * the settled case only: it cuts out the moment the rack moves, holds the field empty while
 * the rack drifts, and stamps in on settle with one misregistered pass in the case colour
 * (signature pattern: the registration stamp). Under reduced motion it swaps without the stamp.
 * Decorative: the caption carries the same title for assistive technology.
 */
export function mountHero(root: HTMLElement, stage: HTMLElement, store: Store): void {
  const ink = root.querySelector<HTMLElement>("[data-hero-ink]")!;
  const ghost = root.querySelector<HTMLElement>("[data-hero-ghost]")!;
  let shown: string | null = null;
  let direction = 1;

  function layout(text: string): void {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const narrow = w < 700;
    const margin = narrow ? 14 : Math.max(24, w * 0.035);
    const fit = fitTitle(text, w - margin * 2, h * (narrow ? 0.42 : 0.52), 3, 0.84, h * (narrow ? 0.26 : 0.34));
    root.style.fontSize = `${fit.size.toFixed(1)}px`;
    const html = fit.lines.map((l) => `<span class="hero__line">${l.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</span>`).join("");
    ink.innerHTML = html;
    ghost.innerHTML = html;
  }

  async function show(state: State): Promise<void> {
    const entry = state.current >= 0 ? state.visible[state.current] : null;
    if (!entry) return;
    await ensureFonts();
    if (store.state.mode !== "settled") return;
    if (shown === entry.name && root.dataset.state === "in") return;
    shown = entry.name;
    layout(entry.title);
    const shell = shellOf(entry);
    root.style.setProperty("--ghost", entry.layout === "specimen" ? SIGNAL : shell.hex);
    root.style.setProperty("--rx", `${direction * 0.06}em`);
    root.style.setProperty("--ry", `${-0.025}em`);
    // Restart the stamp even if the previous one has not finished.
    root.dataset.state = "off";
    void root.offsetWidth;
    root.dataset.state = "in";
  }

  function cut(): void {
    if (root.dataset.state === "in") root.dataset.state = "out";
    shown = null;
  }

  store.on((state, previous) => {
    if (state.current !== previous.current) direction = state.current > previous.current ? 1 : -1;
    // One title per view: the spread carries it while the case is open.
    if (state.mode === "settled") void show(state);
    else cut();
  });

  new ResizeObserver(() => {
    const entry = store.current;
    if (entry && shown === entry.name) layout(entry.title);
  }).observe(stage);
}
