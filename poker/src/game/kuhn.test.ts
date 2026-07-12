import { describe, expect, it } from "vitest";
import {
  actionLabel,
  activePlayer,
  appendAction,
  dealCards,
  isTerminal,
  payoffForPlayer,
  payoffForPlayerZero,
  potForHistory,
  sampleAction,
} from "./kuhn";
import { allStrategies, solverMetadata } from "./policy";

describe("Kuhn rules", () => {
  it("routes decision histories to the correct player", () => {
    expect(activePlayer("")).toBe(0);
    expect(activePlayer("p")).toBe(1);
    expect(activePlayer("b")).toBe(1);
    expect(activePlayer("pb")).toBe(0);
    expect(activePlayer("pbb")).toBeNull();
  });

  it("labels the same action codes by their game context", () => {
    expect(actionLabel("", "p")).toBe("CHECK");
    expect(actionLabel("p", "b")).toBe("BET");
    expect(actionLabel("b", "p")).toBe("FOLD");
    expect(actionLabel("pb", "b")).toBe("CALL");
  });

  it("recognizes terminal histories and their pots", () => {
    expect(isTerminal(appendAction("p", "p"))).toBe(true);
    expect(potForHistory("pp")).toBe(2);
    expect(potForHistory("bp")).toBe(3);
    expect(potForHistory("pbb")).toBe(4);
  });

  it("matches the authoritative terminal payoff table", () => {
    expect(payoffForPlayerZero([3, 1], "pp")).toBe(1);
    expect(payoffForPlayerZero([1, 3], "bb")).toBe(-2);
    expect(payoffForPlayerZero([1, 3], "bp")).toBe(1);
    expect(payoffForPlayerZero([3, 1], "pbp")).toBe(-1);
    expect(payoffForPlayer([1, 3], "pbb", 1)).toBe(2);
  });

  it("deals two distinct cards", () => {
    const cards = dealCards(() => 0.25);
    expect(cards[0]).not.toBe(cards[1]);
  });

  it("samples the mixed policy at its probability boundary", () => {
    expect(sampleAction({ p: 0.4, b: 0.6 }, () => 0.39)).toBe("p");
    expect(sampleAction({ p: 0.4, b: 0.6 }, () => 0.4)).toBe("b");
  });
});

describe("DCFR policy artifact", () => {
  it("contains every Kuhn information set as a valid distribution", () => {
    const strategies = allStrategies();
    expect(Object.keys(strategies)).toHaveLength(12);
    for (const strategy of Object.values(strategies)) {
      expect(strategy.p).toBeGreaterThanOrEqual(0);
      expect(strategy.b).toBeGreaterThanOrEqual(0);
      expect(strategy.p + strategy.b).toBeCloseTo(1, 10);
    }
  });

  it("retains the known game value and exploitability evidence", () => {
    expect(solverMetadata.gameValue).toBeCloseTo(-1 / 18, 2);
    expect(solverMetadata.exploitability).toBeLessThan(0.01);
    expect(solverMetadata.iterations).toBe(10_000);
  });
});
