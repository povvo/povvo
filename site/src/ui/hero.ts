import { fitLogo } from "../logo";
import type { State, Store } from "../state";

/**
 * The title (recipe/direction-v3.md, composition): the project's logo, white, across the top
 * of the stage, the way a band's name sits across the top of a cover. The presented case
 * stands in front of its foot. When the rack settles, the logo opens from its centre line
 * outward, following its own symmetry; when the rack moves it goes. Reduced motion swaps it
 * at once. Decorative: the caption carries the readable name.
 */
export function mountHero(root: HTMLElement, stage: HTMLElement, store: Store): void {
  const field = stage.querySelector<HTMLElement>("[data-field]")!;
  const bar = stage.querySelector<HTMLElement>(".bar")!;
  let shown: string | null = null;

  function layout(text: string): void {
    const cs = getComputedStyle(stage);
    const margin = parseFloat(cs.getPropertyValue("--margin")) || 24;
    const w = field.clientWidth;
    const h = field.clientHeight;
    const narrow = w < 700;
    const top = bar.getBoundingClientRect().bottom - field.getBoundingClientRect().top + margin * 0.5;
    const maxW = Math.min(w - margin * 2, narrow ? w : w * 0.7);
    const maxH = h * (narrow ? 0.26 : 0.32);
    const dpr = Math.min(2, devicePixelRatio || 1);
    const logo = fitLogo(text, maxW * dpr, maxH * dpr, "#fff");
    const k = Math.min(maxW / logo.width, maxH / logo.height);
    const canvas = document.createElement("canvas");
    canvas.width = logo.width;
    canvas.height = logo.height;
    canvas.getContext("2d")!.drawImage(logo, 0, 0);
    canvas.style.width = `${(logo.width * k).toFixed(1)}px`;
    canvas.style.height = `${(logo.height * k).toFixed(1)}px`;
    root.style.top = `${top.toFixed(1)}px`;
    root.style.height = `${maxH.toFixed(1)}px`;
    root.replaceChildren(canvas);
  }

  function show(state: State): void {
    const entry = state.current >= 0 ? state.visible[state.current] : null;
    if (!entry) return;
    if (shown === entry.name && root.dataset.state === "in") return;
    shown = entry.name;
    layout(entry.title);
    root.dataset.state = "off";
    void root.offsetWidth;
    root.dataset.state = "in";
  }

  function cut(): void {
    if (root.dataset.state === "in") root.dataset.state = "out";
    shown = null;
  }

  store.on((state) => {
    // While a case is open the spread carries the logo.
    if (state.mode === "settled") show(state);
    else cut();
  });

  new ResizeObserver(() => {
    const entry = store.current;
    if (entry && shown === entry.name) layout(entry.title);
  }).observe(field);
}
