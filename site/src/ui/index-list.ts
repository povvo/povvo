import { type Entry, type Order, pad2 } from "../catalogue";
import { logoCanvas } from "../logo";
import type { State, Store } from "../state";

/**
 * The index: the catalogue as a tape trader's list (recipe/direction-v3.md), every project's
 * logo beside its name in Helvetica. It is the same list as the rack and drives the same
 * selection. Opened from the header or with `I`; a modal dialog with focus kept inside; Esc
 * closes and focus returns. Logos are drawn as their rows scroll into view.
 */
export function mountIndex(root: HTMLElement, opener: HTMLElement, store: Store): void {
  const list = root.querySelector<HTMLUListElement>("[data-list]")!;
  const find = root.querySelector<HTMLInputElement>("[data-find]")!;
  const empty = root.querySelector<HTMLElement>("[data-empty]")!;
  const tally = root.querySelector<HTMLElement>("[data-index-tally]")!;
  const closeBtn = root.querySelector<HTMLButtonElement>("[data-index-close]")!;
  const orderButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-order-value]")];
  const items = new Map<string, HTMLLIElement>();
  let returnFocus: HTMLElement | null = null;
  const sheet = root.querySelector<HTMLElement>(".index__sheet")!;
  const logos = new IntersectionObserver(
    (seen) => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      for (const e of seen) {
        if (!e.isIntersecting) continue;
        const li = e.target as HTMLElement;
        logos.unobserve(li);
        const slot = li.querySelector<HTMLElement>(".track__logo")!;
        const logo = logoCanvas(li.dataset.title ?? "", 52 * dpr, "#fff");
        const c = document.createElement("canvas");
        c.width = logo.width;
        c.height = logo.height;
        c.getContext("2d")!.drawImage(logo, 0, 0);
        c.style.height = "52px";
        c.style.width = `${(logo.width / logo.height) * 52}px`;
        slot.replaceChildren(c);
      }
    },
    { root: sheet, rootMargin: "200px 0px" },
  );
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
        li.innerHTML = `<span class="track__no"></span><span class="track__logo" aria-hidden="true"></span><span class="track__name"></span><span class="track__meta"><span class="track__code"></span><span class="track__year"></span></span>`;
        li.dataset.title = entry.title;
        logos.observe(li);
        li.addEventListener("click", () => choose(entry));
        items.set(entry.name, li);
      }
      li.id = `track-${entry.no}`;
      li.querySelector(".track__no")!.textContent = pad2(i + 1, n);
      li.querySelector(".track__name")!.textContent = entry.title;
      li.querySelector(".track__code")!.textContent = entry.language ?? "—";
      li.querySelector(".track__year")!.textContent = entry.year;
      li.setAttribute("aria-selected", i === state.current ? "true" : "false");
      li.setAttribute("aria-label", `${pad2(i + 1, n)}, ${entry.title}, ${entry.language ?? "no language"}, ${entry.year}`);
      frag.appendChild(li);
    });
    for (const [name, li] of items) {
      if (!names.has(name)) {
        li.remove();
        logos.unobserve(li);
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
