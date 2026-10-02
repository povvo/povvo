import { SIGNAL, shellOf } from "../catalogue";
import { ensureFonts, fitTitle, metalMode, nameLogo } from "../covers";
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

  function layoutLogo(text: string, ghostColour: string): void {
    // Metal: the name is a generated logo, centred at the foot like a band's on a flyer.
    const w = stage.querySelector<HTMLElement>("[data-field]")!.clientWidth;
    const h = stage.querySelector<HTMLElement>("[data-field]")!.clientHeight;
    const m = margin();
    const maxW = w - m * 2;
    const maxH = h * (w < 700 ? 0.36 : 0.46);
    const dpr = Math.min(2, devicePixelRatio || 1);
    const inkLogo = nameLogo(text, Math.min(220, maxH * 0.42) * dpr, getComputedStyle(root).color || "#111719");
    const ghostLogo = nameLogo(text, Math.min(220, maxH * 0.42) * dpr, ghostColour);
    const k = Math.min(maxW / inkLogo.width, maxH / inkLogo.height);
    root.style.fontSize = "";
    root.dataset.logo = "true";
    for (const [plate, logo] of [[ink, inkLogo], [ghost, ghostLogo]] as const) {
      const line = document.createElement("span");
      line.className = "hero__line hero__line--logo";
      line.style.setProperty("--i", "0");
      const inner = document.createElement("span");
      const img = document.createElement("canvas");
      img.width = logo.width;
      img.height = logo.height;
      img.getContext("2d")!.drawImage(logo, 0, 0);
      img.style.width = `${(logo.width * k).toFixed(1)}px`;
      img.style.height = `${(logo.height * k).toFixed(1)}px`;
      inner.appendChild(img);
      line.appendChild(inner);
      plate.replaceChildren(line);
    }
  }

  function layout(text: string, ghostColour = "#FF4B1F"): void {
    if (metalMode()) return layoutLogo(text, ghostColour);
    delete root.dataset.logo;
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
    const ghostColour = entry.layout === "specimen" ? SIGNAL : shellOf(entry).hex;
    root.style.setProperty("--ghost", ghostColour);
    layout(entry.title, ghostColour);
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
    if (entry && shown === entry.name) layout(entry.title, entry.layout === "specimen" ? SIGNAL : shellOf(entry).hex);
  }).observe(stage);
}
