import type { Spring } from "./motion";

/**
 * The case sequence gates (recipe/direction-v2.md, mechanism changes). Pure, so the review
 * simulation (scripts/simulate-gates.ts) runs exactly what the stage runs.
 *
 * Out:  pull → turn → open.   Back: close → turn back → retract.
 *
 * PULL_CLEAR: a case may begin to turn only once it is out far enough that its turning sweep
 *   (radius 0.709) clears the rack's outer edge: PULL_OUT × 0.9 = 1.44 > 1.414.
 * TURN_BLOCK: no case starts its turn while another is turned more than this.
 * FRONT_CLEAR: no case starts to pull out while another is still on its way home past the
 *   front of the rack (the presented case steps back, then swings home along the arc).
 */
export const PULL_CLEAR = 0.9;
export const TURN_READY = 0.92;
export const OPEN_SHUT = 0.06;
export const TURN_HOME = 0.05;
export const TURN_BLOCK = 0.04;
/** No case starts to pull out while another is still forward of the arc (turn above this). */
export const FRONT_CLEAR = 0.1;

/** Stiffness out and back: the way home is quicker than the way out (exits lead, entries settle). */
export const STIFFNESS = {
  pull: { out: 200, back: 220 },
  turn: { out: 150, back: 220 },
  open: { out: 70, back: 150 },
} as const;

export interface Gated {
  pull: Spring;
  turn: Spring;
  open: Spring;
}

export function gateCase(c: Gated, wantOut: boolean, wantOpen: boolean, anotherTurned: boolean, anotherForward = false): void {
  for (const key of ["pull", "turn", "open"] as const) c[key].tune(c[key].target > c[key].x ? STIFFNESS[key].out : STIFFNESS[key].back);
  if (wantOut) {
    if (c.pull.target < 1 && !anotherForward) c.pull.target = 1;
    if (c.pull.target === 1 && c.turn.target < 1 && c.pull.x > PULL_CLEAR && !anotherTurned) c.turn.target = 1;
    c.open.target = wantOpen && c.turn.x > TURN_READY ? 1 : 0;
  } else {
    c.open.target = 0;
    if (c.open.x < OPEN_SHUT) c.turn.target = 0;
    if (c.turn.x < TURN_HOME) c.pull.target = 0;
  }
}
