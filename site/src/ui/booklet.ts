import { dateLine, position } from "../catalogue";
import { logoArt } from "../art";
import { logoAspect } from "../logo";
import { readmeHtml } from "../readme";
import type { State, Store } from "../state";

/**
 * The sheet (recipe/direction-v4.md, drive): the open disk's contents, a photocopied white
 * sheet with a drive down its left edge. The disk goes into the drive's slot; the light flickers
 * while it reads; the README comes up line by line once both the disk is in and the text has
 * arrived. The logo in black heads it, the readable name in Helvetica under it, then a row of
 * facts, the description and the README. Focus moves to Close and returns on close. Without
 * WebGL, on narrow screens and under reduced motion there is no disk to wait for.
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
  const logoSlot = root.querySelector<HTMLElement>("[data-booklet-logo]")!;
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

  /** Resolves when the disk is in the drive, or at once when there is no disk to wait for. */
  function inserted(state: State): Promise<void> {
    const wait = state.renderer === "webgl" && state.motion === "full" && matchMedia("(min-width: 1024px)").matches;
    if (!wait || document.body.dataset.drive === "reading") return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        window.removeEventListener("drive", on);
        clearTimeout(timer);
        resolve();
      };
      const on = (e: Event) => {
        if ((e as CustomEvent).detail === "reading") done();
      };
      window.addEventListener("drive", on);
      // Never hold the text hostage to the animation.
      const timer = window.setTimeout(done, 1600);
    });
  }

  async function load(state: State): Promise<void> {
    const entry = state.current >= 0 ? state.visible[state.current] : null;
    if (!entry) return;
    const mine = ++token;
    body.innerHTML = `<p class="spread__state" data-reading>Reading the disk</p>`;
    store.setReadme(entry.name, "loading");
    let html: string | null;
    try {
      [html] = await Promise.all([readmeHtml(entry), inserted(state)]);
    } catch {
      if (mine !== token) return;
      body.innerHTML = `<p class="spread__state spread__state--error">The README could not be loaded. <a href="${entry.html_url}#readme" target="_blank" rel="noopener">Read it on GitHub</a>.</p>`;
      store.setReadme(entry.name, "error");
      return;
    }
    if (mine !== token) return; // a newer open superseded this one
    if (html === null) {
      body.innerHTML = `<p class="spread__state spread__state--error">This disk has no README on GitHub yet. <a href="${entry.html_url}" target="_blank" rel="noopener">Open the repository</a> to see its files.</p>`;
      store.setReadme(entry.name, "missing");
      return;
    }
    body.innerHTML = `<article class="readme">${html}</article>`;
    // The first screen of blocks comes up in order, as if read off the disk.
    const blocks = body.querySelectorAll<HTMLElement>(".readme > *");
    blocks.forEach((b, i) => {
      if (i < 24) b.style.setProperty("--i", String(i));
    });
    body.dataset.read = "in";
    store.setReadme(entry.name, "ready");
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
    // The logo is sized to the sheet, so it is drawn once the sheet is showing.
    const dpr = Math.min(2, devicePixelRatio || 1);
    const boxW = Math.max(200, logoSlot.getBoundingClientRect().width);
    const maxH = Math.min(220, innerHeight * 0.24);
    const forName = entry.name;
    logoSlot.replaceChildren();
    void logoArt(entry.title, Math.min(maxH, boxW / logoAspect(entry.title)) * dpr, "#000", 0).then((logo) => {
      if (store.current?.name !== forName) return;
      const k = Math.min(boxW / logo.width, maxH / logo.height);
      const c = document.createElement("canvas");
      c.width = logo.width;
      c.height = logo.height;
      c.getContext("2d")!.drawImage(logo, 0, 0);
      c.style.width = `${(logo.width * k).toFixed(1)}px`;
      c.style.height = `${(logo.height * k).toFixed(1)}px`;
      logoSlot.replaceChildren(c);
    });
    delete body.dataset.read;
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
    // On wide screens the sheet waits for the disk to come out of its drive before it goes.
    const waits = state.renderer === "webgl" && matchMedia("(min-width: 1024px)").matches;
    leaving = window.setTimeout(() => (root.hidden = true), immediate ? 0 : waits ? 460 : 260);
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }

  store.on((state, previous) => {
    if (state.mode === "open" && previous.mode !== "open") show(state);
    else if (state.mode !== "open" && previous.mode === "open") hide(state);
    else if (state.mode === "open" && state.current !== previous.current) show(state);
  });
}
