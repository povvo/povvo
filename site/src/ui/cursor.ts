import type { Store } from "../state";

/**
 * Cursor (fine pointers, full motion only): an ink dot that tracks exactly and a ring that
 * follows on a short spring, with a one-word label that says what a press will do here:
 * Drag over the rack, Open over the case that is out, View over another case, nothing over
 * text and controls (the ring grows instead). The system cursor returns for typing and
 * whenever motion is reduced, and the native cursor stays on every input.
 */
export function mountCursor(root: HTMLElement, canvas: HTMLCanvasElement, store: Store): void {
  if (!matchMedia("(pointer: fine)").matches) return;
  const label = root.querySelector<HTMLElement>("[data-cursor-label]")!;
  const ring = root.querySelector<HTMLElement>(".cursor__ring")!;
  const dot = root.querySelector<HTMLElement>(".cursor__dot")!;
  const pos = { x: -100, y: -100 };
  const lag = { x: -100, y: -100 };
  let raf = 0;
  let active = false;

  function enabled(): boolean {
    return store.state.motion === "full";
  }

  function frame(): void {
    raf = 0;
    lag.x += (pos.x - lag.x) * 0.22;
    lag.y += (pos.y - lag.y) * 0.22;
    dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    ring.style.transform = `translate3d(${lag.x.toFixed(1)}px, ${lag.y.toFixed(1)}px, 0)`;
    label.style.transform = ring.style.transform;
    if (Math.abs(pos.x - lag.x) > 0.2 || Math.abs(pos.y - lag.y) > 0.2) raf = requestAnimationFrame(frame);
  }

  function stateAt(el: Element | null): { mode: string; text: string } {
    if (!el) return { mode: "", text: "" };
    if (el.closest("input, textarea, select")) return { mode: "native", text: "" };
    if (el === canvas) {
      const hover = canvas.dataset.hover;
      if (hover === "current") return { mode: "label", text: store.state.mode === "open" ? "Close" : "Open" };
      if (hover === "case") return { mode: "label", text: "View" };
      return { mode: "label", text: "Drag" };
    }
    if (el.closest("a, button, [role='option']")) return { mode: "grow", text: "" };
    return { mode: "", text: "" };
  }

  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      if (!enabled()) {
        if (active) {
          active = false;
          document.documentElement.dataset.cursor = "off";
        }
        return;
      }
      if (!active) {
        active = true;
        lag.x = e.clientX;
        lag.y = e.clientY;
        document.documentElement.dataset.cursor = "on";
      }
      pos.x = e.clientX;
      pos.y = e.clientY;
      const s = stateAt(document.elementFromPoint(e.clientX, e.clientY));
      root.dataset.mode = s.mode;
      if (label.textContent !== s.text) label.textContent = s.text;
      if (!raf) raf = requestAnimationFrame(frame);
    },
    { passive: true },
  );
  addEventListener("pointerdown", () => root.classList.add("is-down"));
  addEventListener("pointerup", () => root.classList.remove("is-down"));
  document.documentElement.addEventListener("pointerleave", () => (root.dataset.mode = "away"));
  store.on((state, previous) => {
    if (state.motion !== previous.motion && state.motion === "reduced") {
      active = false;
      document.documentElement.dataset.cursor = "off";
    }
  });
}
