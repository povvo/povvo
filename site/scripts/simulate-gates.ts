/**
 * Gate simulation (interactive-and-realtime-motion: interruption and reversal; 3d-motion-design:
 * collision clearance). Runs the stage's own springs and gates (src/motion.ts, src/gates.ts) on
 * three scenarios and checks the invariants the direction promises, for the disk box
 * (recipe/direction-v4.md):
 *   clearance   a disk travels out of its slot towards the camera only once its foot is above
 *               the tops of the disks leaning towards the viewer; until then it stays in its
 *               slot's plane, parallel to its neighbours, with the slot spacing to spare
 *   exclusive   two disks are never out at once
 *   order       a disk goes into the drive only when presented, and turns back only once ejected
 *   front       no disk lifts out while another is still on its way home
 * Run: node --experimental-strip-types scripts/simulate-gates.ts [--output file]
 */
import { writeFileSync } from "node:fs";
import { FRONT_CLEAR, PULL_CLEAR, STIFFNESS, TURN_BLOCK, gateCase } from "../src/gates.ts";
import { Spring } from "../src/motion.ts";

// Disk and box constants, as in src/floppy.ts and src/stage.ts.
const H = 0.94;
const T = 0.033;
const GAP = 0.055;
const LEAN_F = 0.6;
const LEAN_B = 0.16;
const PULL_LIFT = 0.98 * H;
/** Turn below this keeps the disk over its slot (src/stage.ts: travel starts at turn 0.1). */
const TRAVEL_FROM = 0.1;
const DT = 1 / 120;
/**
 * Clearance of a disk from its neighbours. Travelling: the height of its foot, slid up its own
 * plane, over the tops of the disks leaning towards the viewer. Still over its slot: the gap
 * left between parallel neighbours.
 */
function clearance(pull: number, turn: number): number {
  if (turn <= TRAVEL_FROM) return GAP * Math.cos(LEAN_B) - T;
  return pull * PULL_LIFT * Math.cos(LEAN_B) - H * Math.cos(LEAN_F);
}

interface Case {
  name: string;
  pull: Spring;
  turn: Spring;
  open: Spring;
}

function makeCase(name: string): Case {
  return {
    name,
    pull: new Spring(0, { stiffness: 200, ratio: 1 }),
    turn: new Spring(0, { stiffness: 150, ratio: 1 }),
    open: new Spring(0, { stiffness: STIFFNESS.open.out, ratio: 1 }),
  };
}

type Mode = "browsing" | "settled" | "open";
interface Event {
  at: number;
  current?: string;
  mode?: Mode;
}

function run(name: string, events: Event[], seconds: number, start: { current: string; mode: Mode; out: string[] }) {
  const cases = new Map(["A", "B", "C"].map((n) => [n, makeCase(n)]));
  for (const n of start.out) for (const s of ["pull", "turn", "open"] as const) cases.get(n)![s].snap(start.mode === "open" || s !== "open" ? 1 : 0);
  const slot: Record<string, number> = { A: 0, B: 1, C: 2 };
  const pos = new Spring(slot[start.current], { stiffness: 120, ratio: 1 });
  let current = start.current;
  let mode: Mode = start.mode;
  let settledTick = mode === "browsing" ? -1 : 0;
  let tick = 0;
  let minClearanceWhileTurning = Infinity;
  let maxDoubleTurn = 0;
  let maxOpenWhileUnturned = 0;
  let maxPullWhileAnotherForward = 0;
  const marks: Record<string, number> = {};
  const mark = (key: string, t: number) => {
    if (!(key in marks)) marks[key] = Number(t.toFixed(3));
  };
  const queue = events.slice();
  for (let t = 0; t <= seconds; t += DT) {
    while (queue.length && queue[0].at <= t + 1e-9) {
      const e = queue.shift()!;
      if (e.current && e.current !== current) {
        current = e.current;
        pos.target = slot[current];
        mode = "browsing";
        tick++;
      }
      if (e.mode) mode = e.mode;
    }
    pos.step(DT);
    if (mode === "browsing" && pos.settled(0.004, 0.02) && settledTick !== tick) {
      settledTick = tick;
      mode = "settled";
      mark(`settled on ${current}`, t);
    }
    for (const c of cases.values()) {
      let another = false;
      let forward = false;
      for (const o of cases.values()) {
        if (o === c) continue;
        if (o.turn.x > TURN_BLOCK) another = true;
        if (o.turn.x > FRONT_CLEAR) forward = true;
      }
      gateCase(c, c.name === current && (mode === "settled" || mode === "open"), mode === "open", another, forward);
    }
    for (const c of cases.values()) {
      c.pull.step(DT);
      c.turn.step(DT);
      c.open.step(DT);
      if (c.turn.x > 0.001) minClearanceWhileTurning = Math.min(minClearanceWhileTurning, clearance(c.pull.x, c.turn.x));
      if (c.turn.x < 0.9) maxOpenWhileUnturned = Math.max(maxOpenWhileUnturned, c.open.x);
      if (c.pull.x > 0.01) mark(`${c.name} pull starts`, t);
      if (c.turn.target === 1) mark(`${c.name} turn starts`, t);
      if (c.turn.x > 0.99) mark(`${c.name} presented`, t);
      if (c.open.target === 1) mark(`${c.name} opens`, t);
      if (c.open.x > 0.99) mark(`${c.name} open`, t);
      if (start.out.includes(c.name) && c.open.target === 0 && c.open.x < 0.06) mark(`${c.name} shut`, t);
      if (start.out.includes(c.name) && c.turn.target === 0) mark(`${c.name} turns back`, t);
      if (start.out.includes(c.name) && c.pull.target === 0) mark(`${c.name} retracts`, t);
      if (start.out.includes(c.name) && c.pull.target === 0 && c.pull.x < 0.01) mark(`${c.name} home`, t);
    }
    for (const c of cases.values()) {
      const forward = [...cases.values()].some((o) => o !== c && o.turn.x > 0.45);
      if (forward && c.pull.target === 1 && !start.out.includes(c.name)) maxPullWhileAnotherForward = Math.max(maxPullWhileAnotherForward, c.pull.x);
    }
    const turned = [...cases.values()].map((c) => c.turn.x).sort((a, b) => b - a);
    maxDoubleTurn = Math.max(maxDoubleTurn, turned[1]);
  }
  const findings = [];
  if (minClearanceWhileTurning < 0) findings.push({ level: "FAIL", code: "clearance", message: `a travelling disk came within ${minClearanceWhileTurning.toFixed(3)} of the disks in front` });
  if (maxDoubleTurn > 0.06) findings.push({ level: "FAIL", code: "exclusive", message: `two disks out at once (second ${maxDoubleTurn.toFixed(3)})` });
  if (maxPullWhileAnotherForward > 0.02) findings.push({ level: "FAIL", code: "front", message: `a disk lifted ${maxPullWhileAnotherForward.toFixed(3)} while another was still on its way home` });
  if (maxOpenWhileUnturned > 0.08) findings.push({ level: "FAIL", code: "order", message: `a disk was ${maxOpenWhileUnturned.toFixed(3)} into the drive while not presented` });
  return {
    scenario: name,
    status: findings.length ? "FAIL" : "PASS",
    findings,
    min_clearance_while_turning: Number(minClearanceWhileTurning.toFixed(3)),
    max_second_case_turn: Number(maxDoubleTurn.toFixed(4)),
    max_open_while_unturned: Number(maxOpenWhileUnturned.toFixed(4)),
    max_pull_while_another_forward: Number(maxPullWhileAnotherForward.toFixed(4)),
    timeline: Object.entries(marks).sort((a, b) => a[1] - b[1]).map(([what, at]) => ({ at, what })),
  };
}

const results = [
  run("disk in the drive, then flip to the next one", [{ at: 0.2, current: "B" }], 4, { current: "A", mode: "open", out: ["A"] }),
  run("disk in the drive, then three fast flips", [{ at: 0.2, current: "B" }, { at: 0.32, current: "C" }, { at: 0.44, current: "B" }], 4, { current: "A", mode: "open", out: ["A"] }),
  run("presenting disk reversed mid-turn", [{ at: 0.2, current: "B" }, { at: 1.35, current: "A" }], 5, { current: "A", mode: "settled", out: ["A"] }),
];
const out = {
  tool: "simulate-gates",
  pull_clear: PULL_CLEAR,
  status: results.every((r) => r.status === "PASS") ? "PASS" : "FAIL",
  interpretation_boundary: "Simulates the stage's gates and springs at 120 Hz with the disk box's clearance constants; it does not render or test feel.",
  results,
};
const outputAt = process.argv.indexOf("--output");
if (outputAt > 0) writeFileSync(process.argv[outputAt + 1], JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
