import type { Spring } from "./motion";

/**
 * The disk sequence gates (recipe/direction-v4.md). Pure, so the review simulation
 * (scripts/simulate-gates.ts) runs exactly what the stage runs.
 *
 * Out:  lift (pull) → turn → into the drive (open).   Back: eject → turn back → drop home.
 *
 * PULL_CLEAR: a disk may begin to travel only once it is lifted far enough that its foot clears
 *   the tops of the disks leaning towards the viewer: 0.9 × 0.92 × cos 9° = 0.82 > 0.94 × cos 34° = 0.78.
 * TURN_BLOCK: no disk starts its turn while another is turned more than this.
 * FRONT_CLEAR: no disk starts to lift while another is still on its way home.
 */
export const PULL_CLEAR = 0.9;
export const TURN_READY = 0.92;
export const OPEN_SHUT = 0.06;
export const TURN_HOME = 0.05;
export const TURN_BLOCK = 0.04;
/** No disk starts to lift while another is still on its way home (turn above this). */
export const FRONT_CLEAR = 0.1;

/** Stiffness out and back: the way home is quicker than the way out (exits lead, entries settle);
 *  the drive takes its time going in, so the shutter, the turn and the slide each read. */
export const STIFFNESS = {
  pull: { out: 200, back: 220 },
  turn: { out: 150, back: 220 },
  open: { out: 55, back: 150 },
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
