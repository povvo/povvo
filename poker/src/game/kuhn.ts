export type Card = 1 | 2 | 3;
export type Player = 0 | 1;
export type ActionCode = "p" | "b";
export type DecisionHistory = "" | "p" | "b" | "pb";
export type TerminalHistory = "pp" | "bb" | "bp" | "pbp" | "pbb";
export type History = DecisionHistory | TerminalHistory;

export interface Strategy {
  p: number;
  b: number;
}

const TERMINAL_HISTORIES = new Set<History>(["pp", "bb", "bp", "pbp", "pbb"]);
const CARD_LABELS: Record<Card, string> = { 1: "J", 2: "Q", 3: "K" };

export function isTerminal(history: History): history is TerminalHistory {
  return TERMINAL_HISTORIES.has(history);
}

export function activePlayer(history: History): Player | null {
  if (history === "") return 0;
  if (history === "p" || history === "b") return 1;
  if (history === "pb") return 0;
  return null;
}

export function legalActions(history: History): readonly ActionCode[] {
  return activePlayer(history) === null ? [] : ["p", "b"];
}

export function isFacingBet(history: History): history is "b" | "pb" {
  return history === "b" || history === "pb";
}

export function actionLabel(history: History, action: ActionCode): string {
  if (isFacingBet(history)) return action === "p" ? "FOLD" : "CALL";
  return action === "p" ? "CHECK" : "BET";
}

export function appendAction(history: History, action: ActionCode): History {
  if (isTerminal(history)) throw new Error(`Cannot act on terminal history ${history}`);
  return `${history}${action}` as History;
}

export function potForHistory(history: History): number {
  return 2 + [...history].filter((action) => action === "b").length;
}

export function payoffForPlayerZero(
  cards: readonly [Card, Card],
  history: TerminalHistory,
): number {
  const [cardZero, cardOne] = cards;
  if (history === "pp") return cardZero > cardOne ? 1 : -1;
  if (history === "bb" || history === "pbb") return cardZero > cardOne ? 2 : -2;
  if (history === "bp") return 1;
  if (history === "pbp") return -1;
  throw new Error(`Unknown terminal history ${history}`);
}

export function payoffForPlayer(
  cards: readonly [Card, Card],
  history: TerminalHistory,
  player: Player,
): number {
  const payoff = payoffForPlayerZero(cards, history);
  return player === 0 ? payoff : -payoff;
}

export function dealCards(random: () => number = Math.random): [Card, Card] {
  const deck: Card[] = [1, 2, 3];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return [deck[0], deck[1]];
}

export function cardLabel(card: Card): string {
  return CARD_LABELS[card];
}

export function strategyKey(card: Card, history: DecisionHistory): string {
  return `${card}|${history}`;
}

export function sampleAction(
  strategy: Strategy,
  random: () => number = Math.random,
): ActionCode {
  return random() < strategy.p ? "p" : "b";
}

export function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}
