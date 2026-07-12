import policyData from "./kuhn-policy.generated.json";
import type { Card, DecisionHistory, Strategy } from "./kuhn";

interface SolverMetadata {
  algorithm: string;
  parameters: { alpha: number; beta: number; gamma: number };
  iterations: number;
  source: string;
  sourceSha256: string;
  gameValue: number;
  exploitability: number;
  convergenceMean: number;
  checkpoints: Array<{ iteration: number; exploitability: number }>;
}

interface PolicyPayload {
  solver: SolverMetadata;
  policy: Record<string, Strategy>;
}

const payload = policyData as PolicyPayload;

export const solverMetadata = payload.solver;

export function strategyFor(card: Card, history: DecisionHistory): Strategy {
  const strategy = payload.policy[`${card}|${history}`];
  if (!strategy) throw new Error(`Missing Kuhn policy for ${card}|${history}`);
  return strategy;
}

export function allStrategies(): Readonly<Record<string, Strategy>> {
  return payload.policy;
}
