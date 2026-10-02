import { logoArt } from "../art";
import type { Entry } from "../catalogue";
import { logoAspect } from "../logo";

/**
 * The boot screen (recipe/direction-v4.md, loading). It is in the HTML, so it is the first
 * paint. While it shows, the page draws what the first view needs, off the main thread where it
 * can (src/art), uploads it to the GPU and compiles the shaders, so nothing is drawn or
 * compiled mid-gesture later. The current project's logo comes up first, at the size and place
 * the page's own logo will take; a row of disks fills as each is written. At the end the logo
 * slides up into its place on the page and the box rises behind it.
 *
 * Any key, click or tap skips it; what was not finished carries on in the background.
 */
export interface Boot {
  /** Show the project the page will open on. */
  setCurrent(entry: Entry): void;
  progress(done: number, total: number, entry: Entry | null): void;
  /** Resolves when the visitor asks to skip. */
  skipped: Promise<void>;
  /** Run the exit. `onReveal` fires as the page starts to show. */
  finish(onReveal: () => void): Promise<void>;
}

export function mountBoot(stageEl: HTMLElement, opts: { minMs: number; reduced: boolean }): Boot {
  const root = document.querySelector<HTMLElement>("[data-boot-screen]")!;
  const logoSlot = root.querySelector<HTMLElement>("[data-boot-logo]")!;
  const disks = root.querySelector<HTMLElement>("[data-boot-disks]")!;
  const msg = root.querySelector<HTMLElement>("[data-boot-msg]")!;
  const count = root.querySelector<HTMLElement>("[data-boot-count]")!;
  const started = performance.now();
  let finished = false;
  let skip: () => void = () => {};
  const skipped = new Promise<void>((resolve) => (skip = resolve));
  let logoCanvas: HTMLCanvasElement | null = null;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Tab") return;
    skip();
  };
  addEventListener("keydown", onKey);
  root.addEventListener("pointerdown", () => skip());

  /** The page logo's box (src/ui/hero.ts lays it out the same way). */
  function heroBox(): { top: number; maxW: number; maxH: number } {
    const field = stageEl.querySelector<HTMLElement>("[data-field]")!;
    const bar = stageEl.querySelector<HTMLElement>(".bar")!;
    const margin = parseFloat(getComputedStyle(stageEl).getPropertyValue("--margin")) || 24;
    const w = field.clientWidth;
    const h = field.clientHeight;
    const narrow = w < 700;
    const fr = field.getBoundingClientRect();
    return {
      top: bar.getBoundingClientRect().bottom - fr.top + margin * 0.5 + fr.top,
      maxW: Math.min(w - margin * 2, narrow ? w : w * 0.7),
      maxH: h * (narrow ? 0.26 : 0.32),
    };
  }

  let built = 0;
  function meter(total: number, done: number): void {
    while (built < total) {
      const d = document.createElement("span");
      d.className = "boot__disk";
      disks.appendChild(d);
      built++;
    }
    [...disks.children].forEach((c, i) => c.classList.toggle("is-written", i < done));
  }

  return {
    setCurrent(entry) {
      const { maxW, maxH } = heroBox();
      const dpr = Math.min(2, devicePixelRatio || 1);
      void logoArt(entry.title, Math.min(maxH, maxW / logoAspect(entry.title)) * dpr, "#fff", 0).then((logo) => {
        if (finished) return;
        const k = Math.min(maxW / logo.width, maxH / logo.height);
        const c = document.createElement("canvas");
        c.width = logo.width;
        c.height = logo.height;
        c.getContext("2d")!.drawImage(logo, 0, 0);
        c.style.width = `${(logo.width * k).toFixed(1)}px`;
        c.style.height = `${(logo.height * k).toFixed(1)}px`;
        logoSlot.style.height = `${maxH.toFixed(1)}px`;
        logoSlot.replaceChildren(c);
        logoCanvas = c;
        root.dataset.logo = "in";
      });
    },
    progress(done, total, entry) {
      meter(total, done);
      count.textContent = total ? `${String(done).padStart(2, "0")} / ${String(total).padStart(2, "0")}` : "";
      msg.textContent = done >= total && total ? "Ready" : entry ? `Writing ${entry.title}` : "Reading the box";
    },
    skipped,
    async finish(onReveal) {
      if (finished) return;
      const wait = opts.minMs - (performance.now() - started);
      if (wait > 0) await Promise.race([new Promise((r) => setTimeout(r, wait)), skipped]);
      finished = true;
      removeEventListener("keydown", onKey);
      onReveal();
      const done = () => {
        root.remove();
        delete document.body.dataset.boot;
      };
      if (opts.reduced || !logoCanvas) {
        done();
        return;
      }
      // The logo travels from the middle of the screen to the page logo's place, unscaled:
      // it is already drawn at that size.
      const from = logoSlot.getBoundingClientRect();
      const { top, maxH } = heroBox();
      const dy = top + (maxH - from.height) / 2 - from.top;
      root.dataset.phase = "out";
      const travel = logoSlot.animate([{ transform: "none" }, { transform: `translateY(${dy.toFixed(1)}px)` }], { duration: 620, easing: "cubic-bezier(0.65, 0, 0.25, 1)", fill: "forwards" });
      await travel.finished.catch(() => undefined);
      done();
    },
  };
}
