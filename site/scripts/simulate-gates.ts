/**
 * Gate simulation (interactive-and-realtime-motion: interruption and reversal; 3d-motion-design:
 * collision clearance). Runs the stage's own springs and gates (src/motion.ts, src/gates.ts) on
 * three scenarios and checks the invariants the direction promises:
 *   clearance   a case yaws only when it is out far enough to clear the rack, or by less
 *               than the side gap its neighbours leave it while it is still in its slot
 *   exclusive   two cases are never turned at once
 *   order       a case opens only when turned, and turns back only once shut
 *   front       no case pulls out while another is still forward of the arc
 * Run: node --experimental-strip-types scripts/simulate-gates.ts [--output file]
 */
import { writeFileSync } from "node:fs";
import { FRONT_CLEAR, PULL_CLEAR, TURN_BLOCK, gateCase } from "../src/gates.ts";
import { Spring } from "../src/motion.ts";

const PULL_OUT = 1.6;
const SWEEP = 0.709; // farthest point of a turning case from its pivot
const RACK_OUTER = 0.705; // spine edge beyond the slot radius
/** Half the side gap between neighbours at their inner edge, at the tightest arc (five degrees, sixty cases). */
const HALF_GAP = (2 * (3.152 - 0.675) * Math.sin((5 * Math.PI) / 360) - 0.15) / 2;
const DT = 1 / 120;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
/**
 * Clearance of a case from its neighbours. Clear of the rack: the distance its sweep keeps
 * from the rack's outer edge. Still in the slot: the side gap left after its yaw.
 */
function clearance(pull: number, turn: number): number {
  const out = PULL_OUT * pull - SWEEP - RACK_OUTER;
  if (out >= 0) return out;
  const yaw = (Math.PI / 2) * smoothstep(turn);
  return HALF_GAP - SWEEP * Math.sin(yaw);
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
    open: new Spring(0, { stiffness: 70, ratio: 1 }),
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
  if (minClearanceWhileTurning < 0) findings.push({ level: "FAIL", code: "clearance", message: `a turning case came within ${minClearanceWhileTurning.toFixed(3)} of the rack` });
  if (maxDoubleTurn > 0.06) findings.push({ level: "FAIL", code: "exclusive", message: `two cases turned at once (second ${maxDoubleTurn.toFixed(3)})` });
  if (maxPullWhileAnotherForward > 0.02) findings.push({ level: "FAIL", code: "front", message: `a case pulled out ${maxPullWhileAnotherForward.toFixed(3)} while another was still forward of the arc` });
  if (maxOpenWhileUnturned > 0.08) findings.push({ level: "FAIL", code: "order", message: `a case was ${maxOpenWhileUnturned.toFixed(3)} open while not turned` });
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
  run("open case, then turn to the next one", [{ at: 0.2, current: "B" }], 4, { current: "A", mode: "open", out: ["A"] }),
  run("open case, then three fast steps", [{ at: 0.2, current: "B" }, { at: 0.32, current: "C" }, { at: 0.44, current: "B" }], 4, { current: "A", mode: "open", out: ["A"] }),
  run("presenting case reversed mid-turn", [{ at: 0.2, current: "B" }, { at: 1.35, current: "A" }], 5, { current: "A", mode: "settled", out: ["A"] }),
];
const out = {
  tool: "simulate-gates",
  pull_clear: PULL_CLEAR,
  status: results.every((r) => r.status === "PASS") ? "PASS" : "FAIL",
  interpretation_boundary: "Simulates the stage's gates and springs at 120 Hz with the rack geometry's clearance constants; it does not render or test feel.",
  results,
};
const outputAt = process.argv.indexOf("--output");
if (outputAt > 0) writeFileSync(process.argv[outputAt + 1], JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
