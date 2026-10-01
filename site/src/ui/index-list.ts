import { type Order, formatNo } from "../catalogue";
import type { State, Store } from "../state";

/** The index: the same list as the rack, rendered as type. It drives the same selection. */
export function mountIndex(root: HTMLElement, store: Store): void {
  const list = root.querySelector<HTMLUListElement>("[data-list]")!;
  const find = root.querySelector<HTMLInputElement>("[data-find]")!;
  const orderSel = root.querySelector<HTMLSelectElement>("[data-order]")!;
  const empty = root.querySelector<HTMLElement>("[data-empty]")!;
  const items = new Map<string, HTMLLIElement>();

  function render(state: State): void {
    const names = new Set<string>();
    const frag = document.createDocumentFragment();
    state.visible.forEach((entry, i) => {
      names.add(entry.name);
      let li = items.get(entry.name);
      if (!li) {
        li = document.createElement("li");
        li.className = "line";
        li.setAttribute("role", "option");
        li.dataset.name = entry.name;
        li.innerHTML = `<span class="line__no"></span><span class="line__name"></span><span class="line__lang"></span><span class="line__year"></span>`;
        li.addEventListener("click", () => {
          const idx = store.state.visible.findIndex((e) => e.name === entry.name);
          if (idx < 0) return;
          if (idx === store.state.current && (store.state.mode === "settled" || store.state.mode === "browsing")) store.open();
          else store.select(idx, "index");
        });
        items.set(entry.name, li);
      }
      li.id = `line-${entry.no}`;
      li.querySelector(".line__no")!.textContent = formatNo(entry.no);
      li.querySelector(".line__name")!.textContent = entry.name;
      li.querySelector(".line__lang")!.textContent = entry.stargazers_count > 0 ? `${entry.code} · ${entry.stargazers_count} ★` : entry.code;
      li.querySelector(".line__year")!.textContent = entry.year;
      li.setAttribute("aria-selected", i === state.current ? "true" : "false");
      frag.appendChild(li);
    });
    for (const [name, li] of items) {
      if (!names.has(name)) {
        li.remove();
        items.delete(name);
      }
    }
    list.replaceChildren(frag);
    empty.hidden = state.visible.length > 0 || state.mode === "loading";
    const current = state.current >= 0 ? state.visible[state.current] : null;
    if (current) list.setAttribute("aria-activedescendant", `line-${current.no}`);
    else list.removeAttribute("aria-activedescendant");
  }

  function reveal(state: State): void {
    const current = state.current >= 0 ? state.visible[state.current] : null;
    if (!current) return;
    const li = items.get(current.name);
    if (!li) return;
    const listRect = list.getBoundingClientRect();
    const r = li.getBoundingClientRect();
    if (r.top < listRect.top || r.bottom > listRect.bottom) {
      li.scrollIntoView({ block: "nearest", behavior: state.motion === "full" ? "smooth" : "auto" });
    }
  }

  find.addEventListener("input", () => store.setQuery(find.value));
  find.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (store.state.current >= 0) store.open();
    }
    if (e.key === "Escape" && find.value) {
      find.value = "";
      store.setQuery("");
    }
  });
  orderSel.addEventListener("change", () => store.setOrder(orderSel.value as Order));

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
      case " ":
        e.preventDefault();
        store.open();
        break;
    }
  });

  store.on((state, previous) => {
    if (state.visible !== previous.visible || state.current !== previous.current || state.mode !== previous.mode) {
      render(state);
      reveal(state);
    }
  });
  render(store.state);
}
