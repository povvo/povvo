import { SIGNAL, shellOf } from "../catalogue";
import { ensureFonts, fitTitle } from "../covers";
import type { State, Store } from "../state";

/**
 * The title (recipe/critique-v2.md, rule 2): one word-object, anchored to the foot of the stage
 * on column one, at a near-constant size from project to project (it shrinks only when a long
 * name needs two lines). The presented case floats above and just overlaps its top edge.
 *
 * Motion is a two-plate print: when the rack settles the shell-colour plate rises through its
 * line masks first and the ink plate lands on it a beat later, registering exactly. When the
 * rack moves, the lines drop out of their masks. Reduced motion swaps without either.
 * Decorative: the caption carries the same title for assistive technology.
 */
export function mountHero(root: HTMLElement, stage: HTMLElement, store: Store): void {
  const ink = root.querySelector<HTMLElement>("[data-hero-ink]")!;
  const ghost = root.querySelector<HTMLElement>("[data-hero-ghost]")!;
  let shown: string | null = null;

  function margin(): number {
    return parseFloat(getComputedStyle(stage).getPropertyValue("--margin")) || 32;
  }

  function layout(text: string): void {
    const w = stage.querySelector<HTMLElement>("[data-field]")!.clientWidth;
    const h = stage.querySelector<HTMLElement>("[data-field]")!.clientHeight;
    const narrow = w < 700;
    const m = margin();
    const fit = fitTitle(text, w - m * 2, h * (narrow ? 0.3 : 0.38), narrow ? 3 : 2, 0.84, h * (narrow ? 0.17 : 0.27));
    root.style.fontSize = `${fit.size.toFixed(1)}px`;
    const esc = (l: string) => l.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    const html = fit.lines.map((l, i) => `<span class="hero__line" style="--i:${i}"><span>${esc(l)}</span></span>`).join("");
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
    root.style.setProperty("--ghost", entry.layout === "specimen" ? SIGNAL : shellOf(entry).hex);
    root.dataset.state = "off";
    void root.offsetWidth;
    root.dataset.state = "in";
  }

  function cut(): void {
    if (root.dataset.state === "in") root.dataset.state = "out";
    shown = null;
  }

  store.on((state) => {
    // One title per view: the spread carries it while the case is open.
    if (state.mode === "settled") void show(state);
    else cut();
  });

  new ResizeObserver(() => {
    const entry = store.current;
    if (entry && shown === entry.name) layout(entry.title);
  }).observe(stage);
}
