import { type Entry, type Order, matches, orderEntries } from "./catalogue";
import type { Source } from "./data";
import type { MotionPreference } from "./motion";

/**
 * Product state, owned here and nowhere else. The stage and the index both render it.
 *
 * Modes (interactive-and-realtime-motion: state model and feedback):
 *   loading  → the catalogue is not yet available; the caption says so in text.
 *   failed   → neither live nor snapshot data loaded; recovery is a link to GitHub.
 *   browsing → the rack is turning or about to; no case is out.
 *   settled  → the rack has stopped on `current`; that case is out of the rack.
 *   open     → the settled case is open and the booklet shows its README.
 *
 * `current` is the committed selection (an index into `visible`). The stage owns the
 * continuous rack position in flight; it reports `settle()` when the spring has stopped.
 */
export type Mode = "loading" | "failed" | "browsing" | "settled" | "open";
export type ReadmeStatus = "idle" | "loading" | "ready" | "missing" | "error";

export interface State {
  all: Entry[];
  visible: Entry[];
  order: Order;
  query: string;
  current: number;
  mode: Mode;
  readme: { status: ReadmeStatus; html?: string; name?: string };
  source: Source | null;
  generatedAt: string | null;
  motion: MotionPreference;
  renderer: "pending" | "webgl" | "flat";
  /** Increments on every explicit selection so listeners can distinguish repeats. */
  selectionTick: number;
  /** Who moved the selection last; the caption reads it to decide what to announce. */
  via: "init" | "keys" | "wheel" | "drag" | "index" | "order";
}

type Listener = (state: State, previous: State) => void;

export class Store {
  state: State;
  private listeners = new Set<Listener>();

  constructor(motion: MotionPreference) {
    this.state = {
      all: [],
      visible: [],
      order: "accession",
      query: "",
      current: -1,
      mode: "loading",
      readme: { status: "idle" },
      source: null,
      generatedAt: null,
      motion,
      renderer: "pending",
      selectionTick: 0,
      via: "init",
    };
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private commit(patch: Partial<State>): void {
    const previous = this.state;
    this.state = { ...previous, ...patch };
    for (const fn of this.listeners) fn(this.state, previous);
  }

  get current(): Entry | null {
    const { visible, current } = this.state;
    return current >= 0 && current < visible.length ? visible[current] : null;
  }

  /** Catalogue arrived (snapshot, cache, live or stress). Keeps the current case if it still exists. */
  setCatalogue(entries: Entry[], source: Source, generatedAt: string | null): void {
    const keep = this.current?.name ?? null;
    const visible = this.derive(entries, this.state.order, this.state.query);
    let current = keep ? visible.findIndex((e) => e.name === keep) : -1;
    if (current < 0) current = visible.length ? visible.length - 1 : -1;
    const mode: Mode = visible.length === 0 ? "failed" : this.state.mode === "loading" ? "browsing" : this.state.mode;
    this.commit({ all: entries, visible, source, generatedAt, current, mode, selectionTick: this.state.selectionTick + 1, via: "init" });
  }

  fail(): void {
    this.commit({ mode: "failed" });
  }

  private derive(all: Entry[], order: Order, query: string): Entry[] {
    return orderEntries(all, order).filter((e) => matches(e, query));
  }

  setOrder(order: Order): void {
    const keep = this.current?.name ?? null;
    const visible = this.derive(this.state.all, order, this.state.query);
    const current = keep ? visible.findIndex((e) => e.name === keep) : Math.min(this.state.current, visible.length - 1);
    this.commit({ order, visible, current, mode: this.leaveOpen("browsing"), via: "order", selectionTick: this.state.selectionTick + 1 });
  }

  setQuery(query: string): void {
    const keep = this.current?.name ?? null;
    const visible = this.derive(this.state.all, this.state.order, query);
    let current = keep ? visible.findIndex((e) => e.name === keep) : -1;
    if (current < 0) current = visible.length ? 0 : -1;
    this.commit({ query, visible, current, mode: visible.length ? this.leaveOpen("browsing") : this.state.mode, via: "index", selectionTick: this.state.selectionTick + 1 });
  }

  /** Any rotation input leaves `open` and `settled`. */
  private leaveOpen(next: Mode): Mode {
    if (this.state.mode === "loading" || this.state.mode === "failed") return this.state.mode;
    return next;
  }

  select(index: number, via: State["via"]): void {
    const { visible } = this.state;
    if (!visible.length) return;
    const current = Math.min(visible.length - 1, Math.max(0, index));
    this.commit({ current, mode: this.leaveOpen("browsing"), via, selectionTick: this.state.selectionTick + 1 });
  }

  step(delta: number, via: State["via"]): void {
    if (!this.state.visible.length) return;
    this.select(this.state.current + delta, via);
  }

  /** The stage reports that the rack has stopped on the current case. */
  settle(): void {
    if (this.state.mode === "browsing") this.commit({ mode: "settled" });
  }

  /** The stage reports motion has begun again (drag start). */
  unsettle(): void {
    if (this.state.mode === "settled" || this.state.mode === "open") this.commit({ mode: "browsing" });
  }

  open(): void {
    if (this.state.mode === "settled" || this.state.mode === "browsing") {
      if (this.current) this.commit({ mode: "open" });
    }
  }

  close(): void {
    if (this.state.mode === "open") this.commit({ mode: "settled" });
  }

  setReadme(name: string, status: ReadmeStatus, html?: string): void {
    this.commit({ readme: { status, html, name } });
  }

  setMotion(motion: MotionPreference): void {
    this.commit({ motion });
  }

  setRenderer(renderer: State["renderer"]): void {
    this.commit({ renderer });
  }
}
