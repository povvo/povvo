import type { Store } from "../state";

/**
 * The flicker (metal only): every so often the whole page goes photo-negative for a few frames.
 * Kept inside the general flash threshold (WCAG 2.3.1, no more than three flashes in any
 * second): one burst is at most two flashes within about 170 ms, bursts are at least 15 s
 * apart, and none comes in the first 8 s. It never runs under reduced motion, while a case is
 * open for reading, while the index is open, or when the tab is hidden. The Motion control in
 * the bar turns it off.
 */
export function mountFlicker(store: Store): void {
  let timer = 0;
  const root = document.documentElement;

  function allowed(): boolean {
    const s = store.state;
    return s.motion === "full" && !document.hidden && s.mode !== "open" && s.mode !== "loading" && document.body.dataset.index !== "open";
  }

  function schedule(min = 15000): void {
    clearTimeout(timer);
    timer = window.setTimeout(burst, min + Math.random() * 25000);
  }

  function burst(): void {
    if (!allowed()) return schedule(6000);
    // Two flashes: on 70 ms, off 55 ms, on 45 ms, off.
    const steps: [boolean, number][] = [[true, 70], [false, 55], [true, 45]];
    let t = 0;
    for (const [on, ms] of steps) {
      window.setTimeout(() => root.classList.toggle("is-inverted", on && allowed()), t);
      t += ms;
    }
    window.setTimeout(() => root.classList.remove("is-inverted"), t);
    schedule();
  }

  store.on((state, previous) => {
    if (state.motion !== previous.motion && state.motion === "reduced") root.classList.remove("is-inverted");
  });
  schedule(8000);
}
