import type { Scene } from "../xerox";

/**
 * The art pipeline's jobs (recipe/direction-v4.md, loading). Bump ART_VERSION whenever a
 * generator's output changes, so cached drawings from older generators are discarded.
 */
export const ART_VERSION = 4;
export const CACHE_NAME = `elb-art-v${ART_VERSION}`;

export type Job =
  | { kind: "logo"; text: string; height: number; ink: string }
  | { kind: "photo"; seed: string; scene: Scene; w: number; h: number };

export function jobKey(job: Job): string {
  return job.kind === "logo"
    ? `logo/${job.height}/${job.ink.replace("#", "")}/${encodeURIComponent(job.text.trim().toLowerCase())}`
    : `photo/${job.scene}/${job.w}x${job.h}/${encodeURIComponent(job.seed)}`;
}
