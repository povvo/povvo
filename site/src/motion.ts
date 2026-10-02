/**
 * Motion primitives. The rack, the extraction and the opening are all springs so that a
 * change of target mid-flight keeps position and velocity (motion-foundations:
 * interruption, reversal and retargeting). Nothing here loops.
 */

export interface SpringOptions {
  /** Natural frequency control: higher settles faster. */
  stiffness: number;
  /** 1 is critically damped (no overshoot). Below 1 overshoots; above 1 is sluggish. */
  ratio?: number;
  mass?: number;
}

export class Spring {
  x: number;
  v = 0;
  target: number;
  k: number;
  c: number;
  readonly m: number;

  constructor(initial: number, opts: SpringOptions) {
    this.x = initial;
    this.target = initial;
    this.k = opts.stiffness;
    this.m = opts.mass ?? 1;
    this.c = 2 * Math.sqrt(this.k * this.m) * (opts.ratio ?? 1);
  }

  /** Semi-implicit Euler with sub-stepping; stable for the stiffness range used here. */
  step(dt: number): number {
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = (-this.k * (this.x - this.target) - this.c * this.v) / this.m;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }

  settled(tolerance = 0.002, velocityTolerance = 0.01): boolean {
    return Math.abs(this.x - this.target) < tolerance && Math.abs(this.v) < velocityTolerance;
  }

  /** Change stiffness (and damping ratio) in flight; position and velocity are kept. */
  tune(stiffness: number, ratio = 1): void {
    if (this.k === stiffness) return;
    this.k = stiffness;
    this.c = 2 * Math.sqrt(stiffness * this.m) * ratio;
  }

  /** Jump without motion: the reduced-motion equivalent. */
  snap(value = this.target): void {
    this.x = value;
    this.target = value;
    this.v = 0;
  }
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
/** Ease-out for finite, predetermined one-way travel (the arrival only). */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

export type MotionPreference = "full" | "reduced";

/** System preference, overridable by the footer control (persisted). */
export function readMotionPreference(): MotionPreference {
  try {
    const stored = localStorage.getItem("barrett-catalogue:motion");
    if (stored === "full" || stored === "reduced") return stored;
  } catch {
    /* ignore */
  }
  return matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
}

export function storeMotionPreference(pref: MotionPreference): void {
  try {
    localStorage.setItem("barrett-catalogue:motion", pref);
  } catch {
    /* ignore */
  }
}
