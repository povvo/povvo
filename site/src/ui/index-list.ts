import { type Entry, type Order, pad2 } from "../catalogue";
import { drawInsert, ensureFonts } from "../covers";
import type { State, Store } from "../state";

/**
 * The index: the tracklist as a full-screen cockpit (recipe/critique-v2.md, rule 5). It is the
 * same list as the rack and drives the same selection. Opened from the header or with `I`;
 * a modal dialog with focus kept inside; Esc closes and focus returns. Rows are set large in
 * the display face; on fine pointers a cover follows the pointer over the row it is on.
 */
export function mountIndex(root: HTMLElement, opener: HTMLElement, store: Store): void {
  const list = root.querySelector<HTMLUListElement>("[data-list]")!;
  const find = root.querySelector<HTMLInputElement>("[data-find]")!;
  const empty = root.querySelector<HTMLElement>("[data-empty]")!;
  const tally = root.querySelector<HTMLElement>("[data-index-tally]")!;
  const closeBtn = root.querySelector<HTMLButtonElement>("[data-index-close]")!;
  const preview = root.querySelector<HTMLElement>("[data-preview]")!;
  const orderButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-order-value]")];
  const items = new Map<string, HTMLLIElement>();
  const covers = new Map<string, HTMLCanvasElement>();
  let returnFocus: HTMLElement | null = null;
  let closing = 0;

  // ---------- rows ----------
  function render(state: State): void {
    const names = new Set<string>();
    const frag = document.createDocumentFragment();
    const n = state.visible.length;
    state.visible.forEach((entry, i) => {
      names.add(entry.name);
      let li = items.get(entry.name);
      if (!li) {
        li = document.createElement("li");
        li.className = "track";
        li.setAttribute("role", "option");
        li.dataset.name = entry.name;
        li.innerHTML = `<span class="track__no"></span><span class="track__name"></span><span class="track__meta"><span class="track__code"></span><span class="track__year"></span></span>`;
        li.addEventListener("click", () => choose(entry));
        li.addEventListener("pointerenter", (e) => {
          if (e.pointerType === "mouse") showPreview(entry);
        });
        items.set(entry.name, li);
      }
      li.id = `track-${entry.no}`;
      li.querySelector(".track__no")!.textContent = pad2(i + 1, n);
      li.querySelector(".track__name")!.textContent = entry.title;
      li.querySelector(".track__code")!.textContent = entry.stargazers_count > 0 ? `${entry.code} ★${entry.stargazers_count}` : entry.code;
      li.querySelector(".track__year")!.textContent = entry.year;
      li.setAttribute("aria-selected", i === state.current ? "true" : "false");
      li.setAttribute("aria-label", `${pad2(i + 1, n)}, ${entry.title}, ${entry.language ?? "no language"}, ${entry.year}`);
      frag.appendChild(li);
    });
    for (const [name, li] of items) {
      if (!names.has(name)) {
        li.remove();
        items.delete(name);
      }
    }
    list.replaceChildren(frag);
    empty.hidden = n > 0 || state.mode === "loading";
    const total = state.all.length;
    tally.textContent = total ? (n === total ? `${pad2(n, n)} projects` : `${pad2(n, total)} of ${pad2(total, total)}`) : "";
    for (const b of orderButtons) b.setAttribute("aria-pressed", String(b.dataset.orderValue === state.order));
    const current = state.current >= 0 ? state.visible[state.current] : null;
    if (current) list.setAttribute("aria-activedescendant", `track-${current.no}`);
    else list.removeAttribute("aria-activedescendant");
  }

  function reveal(state: State): void {
    const current = state.current >= 0 ? state.visible[state.current] : null;
    if (!current || root.hidden) return;
    const li = items.get(current.name);
    if (!li) return;
    const sheet = list.closest<HTMLElement>(".index__sheet")!;
    const r = li.getBoundingClientRect();
    const head = root.querySelector<HTMLElement>(".index__head")!.getBoundingClientRect();
    if (r.top < head.bottom || r.bottom > innerHeight) {
      sheet.scrollTo({ top: sheet.scrollTop + r.top - innerHeight / 2 + r.height / 2, behavior: state.motion === "full" ? "smooth" : "auto" });
    }
  }

  function choose(entry: Entry): void {
    const idx = store.state.visible.findIndex((e) => e.name === entry.name);
    if (idx < 0) return;
    const already = idx === store.state.current;
    close();
    if (already && (store.state.mode === "settled" || store.state.mode === "browsing")) store.open();
    else store.select(idx, "index");
  }

  // ---------- open and close ----------
  function open(): void {
    if (!root.hidden && root.dataset.phase !== "out") return;
    clearTimeout(closing);
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : opener;
    if (store.state.mode === "open") store.close();
    root.hidden = false;
    root.dataset.phase = "in";
    document.body.dataset.index = "open";
    opener.setAttribute("aria-expanded", "true");
    render(store.state);
    requestAnimationFrame(() => {
      reveal(store.state);
      find.focus({ preventScroll: true });
    });
  }

  function close(): void {
    if (root.hidden) return;
    root.dataset.phase = "out";
    delete document.body.dataset.index;
    opener.setAttribute("aria-expanded", "false");
    hidePreview();
    clearTimeout(closing);
    closing = window.setTimeout(() => (root.hidden = true), store.state.motion === "reduced" ? 0 : 320);
    const back = returnFocus && document.contains(returnFocus) ? returnFocus : opener;
    back.focus({ preventScroll: true });
    returnFocus = null;
  }

  opener.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if ((e.key === "i" || e.key === "I") && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && root.hidden) {
      e.preventDefault();
      open();
    }
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (find.value && document.activeElement === find) {
        find.value = "";
        store.setQuery("");
      } else close();
      return;
    }
    if (e.key === "Tab") {
      // Keep focus inside the dialog.
      const focusables = [...root.querySelectorAll<HTMLElement>("input, button, [tabindex='0']")].filter((el) => !el.closest("[hidden]"));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  find.addEventListener("input", () => store.setQuery(find.value));
  find.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list.focus();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const cur = store.current;
      if (cur) choose(cur);
    }
  });
  for (const b of orderButtons) b.addEventListener("click", () => store.setOrder(b.dataset.orderValue as Order));

  list.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        store.step(1, "index");
        break;
      case "ArrowUp":
        e.preventDefault();
        store.step(-1, "index");
        break;
      case "Home":
        e.preventDefault();
        store.select(0, "index");
        break;
      case "End":
        e.preventDefault();
        store.select(store.state.visible.length - 1, "index");
        break;
      case "Enter":
      case " ": {
        e.preventDefault();
        const cur = store.current;
        if (cur) choose(cur);
        break;
      }
    }
  });

  // ---------- cover preview ----------
  const fine = matchMedia("(pointer: fine)").matches;
  const target = { x: innerWidth * 0.7, y: innerHeight * 0.5 };
  const at = { x: target.x, y: target.y, tilt: 0 };
  let previewName: string | null = null;
  let raf = 0;

  async function showPreview(entry: Entry): Promise<void> {
    if (!fine) return;
    previewName = entry.name;
    await ensureFonts();
    if (previewName !== entry.name) return;
    let c = covers.get(entry.name);
    if (!c) {
      c = drawInsert(entry, 360);
      c.className = "index__cover";
      covers.set(entry.name, c);
    }
    preview.replaceChildren(c);
    preview.dataset.on = "true";
    if (!raf) raf = requestAnimationFrame(follow);
  }

  function hidePreview(): void {
    previewName = null;
    preview.dataset.on = "false";
  }

  function follow(): void {
    raf = 0;
    const reduced = store.state.motion === "reduced";
    const k = reduced ? 1 : 0.16;
    const dx = target.x - at.x;
    at.x += dx * k;
    at.y += (target.y - at.y) * k;
    at.tilt += (Math.max(-8, Math.min(8, dx * 0.05)) - at.tilt) * 0.2;
    preview.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${(reduced ? 0 : at.tilt).toFixed(2)}deg)`;
    if (previewName && (Math.abs(dx) > 0.3 || Math.abs(target.y - at.y) > 0.3 || Math.abs(at.tilt) > 0.05)) raf = requestAnimationFrame(follow);
  }

  root.addEventListener("pointermove", (e) => {
    target.x = e.clientX + 150;
    target.y = e.clientY;
    if (previewName && !raf) raf = requestAnimationFrame(follow);
  });
  list.addEventListener("pointerleave", hidePreview);

  store.on((state, previous) => {
    if (state.visible !== previous.visible || state.current !== previous.current || state.mode !== previous.mode || state.order !== previous.order) {
      render(state);
      // A new search or order starts the list from the top; otherwise keep the current row in view.
      if (state.query !== previous.query || state.order !== previous.order) list.closest<HTMLElement>(".index__sheet")!.scrollTop = 0;
      else reveal(state);
    }
  });
  render(store.state);
}
