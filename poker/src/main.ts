import "@fontsource-variable/roboto-condensed/wght.css";
import "@fontsource-variable/roboto-condensed/wght-italic.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./style.css";

import {
  actionLabel,
  activePlayer,
  appendAction,
  cardLabel,
  dealCards,
  formatSigned,
  isTerminal,
  payoffForPlayer,
  potForHistory,
  sampleAction,
  type ActionCode,
  type Card,
  type DecisionHistory,
  type History,
  type Player,
  type Strategy,
} from "./game/kuhn";
import { solverMetadata, strategyFor } from "./game/policy";

const MATCH_TARGET = 7;
const ACTION_BEAT_MS = 420;
const AI_THINK_MS = 1200;
const RESULT_LOCK_MS = 900;
const app = getAppRoot();

function getAppRoot(): HTMLDivElement {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) throw new Error("Missing #app mount point");
  return root;
}

type Phase = "active" | "resolving" | "settled" | "complete";

interface ActionRecord {
  player: Player;
  history: DecisionHistory;
  action: ActionCode;
  label: string;
}

interface AiDecision {
  card: Card;
  history: DecisionHistory;
  strategy: Strategy;
  action: ActionCode;
}

interface GameState {
  hand: number;
  humanPosition: Player;
  cards: [Card, Card];
  history: History;
  humanScore: number;
  phase: Phase;
  actionLocked: boolean;
  aiThinking: boolean;
  revealed: boolean;
  actions: ActionRecord[];
  lastAiDecision: AiDecision | null;
  handPayoff: number;
}

let timer: number | undefined;
let state: GameState = createHand(1, 0);
let keyboardNavigation = false;

function createHand(hand: number, humanScore: number): GameState {
  return {
    hand,
    humanPosition: ((hand - 1) % 2) as Player,
    cards: dealCards(),
    history: "",
    humanScore,
    phase: "active",
    actionLocked: false,
    aiThinking: false,
    revealed: false,
    actions: [],
    lastAiDecision: null,
    handPayoff: 0,
  };
}

function clearTimer(): void {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
}

function aiPosition(): Player {
  return state.humanPosition === 0 ? 1 : 0;
}

function actorName(player: Player): string {
  return player === state.humanPosition ? "YOU" : "POVVO";
}

function playerCard(player: Player): Card {
  return state.cards[player];
}

function nextHand(): void {
  clearTimer();
  state = createHand(state.hand + 1, state.humanScore);
  advanceTurn();
}

function resetMatch(): void {
  clearTimer();
  state = createHand(1, 0);
  advanceTurn();
}

function commitAction(player: Player, action: ActionCode): void {
  if (state.phase !== "active" || state.actionLocked || state.aiThinking) return;
  const turn = activePlayer(state.history);
  if (turn !== player) return;
  clearTimer();

  const history = state.history as DecisionHistory;
  state.actions.push({
    player,
    history,
    action,
    label: actionLabel(history, action),
  });
  state.history = appendAction(history, action);
  state.actionLocked = true;
  render();

  timer = window.setTimeout(() => {
    state.actionLocked = false;
    advanceTurn();
  }, ACTION_BEAT_MS);
}

function advanceTurn(): void {
  clearTimer();

  if (isTerminal(state.history)) {
    settleHand();
    return;
  }

  const turn = activePlayer(state.history);
  if (turn === null) return;

  if (turn === aiPosition()) {
    state.aiThinking = true;
    render();
    timer = window.setTimeout(() => {
      if (state.phase !== "active") return;
      state.aiThinking = false;
      const history = state.history as DecisionHistory;
      const card = playerCard(aiPosition());
      const strategy = strategyFor(card, history);
      const action = sampleAction(strategy);
      state.lastAiDecision = { card, history, strategy, action };
      commitAction(aiPosition(), action);
    }, AI_THINK_MS);
  } else {
    render(true);
  }
}

function settleHand(): void {
  if (!isTerminal(state.history)) return;
  state.phase = "resolving";
  render();

  timer = window.setTimeout(() => {
    if (!isTerminal(state.history)) return;
    state.handPayoff = payoffForPlayer(state.cards, state.history, state.humanPosition);
    state.humanScore += state.handPayoff;
    state.revealed = true;
    state.phase = Math.abs(state.humanScore) >= MATCH_TARGET ? "complete" : "settled";
    render(true);
  }, RESULT_LOCK_MS);
}

function statusCopy(): { eyebrow: string; title: string; detail: string } {
  if (state.phase === "resolving") {
    return {
      eyebrow: "HAND LOCK / VERIFYING",
      title: "RESOLVING",
      detail: `POT ${potForHistory(state.history)} / TRACE ${historyLabel(state.history)}`,
    };
  }

  if (state.phase === "settled" || state.phase === "complete") {
    const winner =
      state.phase === "complete"
        ? state.handPayoff > 0
          ? "YOU WON THE MATCH"
          : "YOU LOST THE MATCH"
        : state.handPayoff > 0
          ? "YOU WON THE HAND"
          : "YOU LOST THE HAND";
    return {
      eyebrow: state.phase === "complete" ? "MATCH COMPLETE" : "HAND COMPLETE",
      title: winner,
      detail: `${formatSigned(state.handPayoff)} LEDGER / ${terminalDetail()}`,
    };
  }

  if (state.actionLocked) {
    const next = activePlayer(state.history);
    if (next === null) {
      return {
        eyebrow: "ACTION LOCKED / HAND CLOSED",
        title: "RESULT PENDING",
        detail: `POT ${potForHistory(state.history)} / TRACE ${historyLabel(state.history)}`,
      };
    }

    return next === state.humanPosition
      ? {
          eyebrow: "POVVO / ACTION LOCKED",
          title: "YOUR TURN NEXT",
          detail: `POT ${potForHistory(state.history)} / TRACE ${historyLabel(state.history)}`,
        }
      : {
          eyebrow: "YOU / ACTION LOCKED",
          title: "PASSING TO POVVO",
          detail: `POT ${potForHistory(state.history)} / TRACE ${historyLabel(state.history)}`,
        };
  }

  if (state.aiThinking) {
    return {
      eyebrow: "POVVO / POLICY SEALED",
      title: "INSPECTING",
      detail: `POT ${potForHistory(state.history)} / POSITION ${aiPosition() === 0 ? "OPEN" : "RESPONSE"}`,
    };
  }

  return {
    eyebrow: "YOUR ACTION",
    title: isFacingCurrentBet() ? "ANSWER THE BET" : "SET THE LINE",
    detail: `POT ${potForHistory(state.history)} / POSITION ${state.humanPosition === 0 ? "OPEN" : "RESPONSE"}`,
  };
}

function isFacingCurrentBet(): boolean {
  return state.history === "b" || state.history === "pb";
}

function historyLabel(history: History): string {
  if (!history) return "START";
  let cursor: History = "";
  return [...history]
    .map((action) => {
      const label = actionLabel(cursor, action as ActionCode);
      cursor = appendAction(cursor, action as ActionCode);
      return label;
    })
    .join(" / ");
}

function terminalDetail(): string {
  if (!isTerminal(state.history)) return "";
  if (state.history === "bp" || state.history === "pbp") {
    const folder = state.actions.at(-1);
    return `${folder ? actorName(folder.player) : "PLAYER"} FOLDED / NO SHOWDOWN`;
  }
  return `YOU ${cardLabel(playerCard(state.humanPosition))} : POVVO ${cardLabel(playerCard(aiPosition()))} / SHOWDOWN`;
}

function resultMarkup(): string {
  if (state.phase !== "settled" && state.phase !== "complete") return "";

  const humanWon = state.handPayoff > 0;
  const matchComplete = state.phase === "complete";
  const title = matchComplete
    ? humanWon
      ? "YOU WON THE MATCH"
      : "YOU LOST THE MATCH"
    : humanWon
      ? "YOU WON THE HAND"
      : "YOU LOST THE HAND";
  const eyebrow = matchComplete ? "MATCH RESULT / CONFIRMED" : `HAND ${String(state.hand).padStart(2, "0")} / RESULT`;

  return `
    <div class="hand-result hand-result--${humanWon ? "win" : "loss"}" role="status" aria-live="polite" aria-atomic="true">
      <div class="hand-result__copy">
        <span>${eyebrow}</span>
        <strong>${title}</strong>
        <small>${terminalDetail()}</small>
      </div>
      <div class="hand-result__score" aria-label="${formatSigned(state.handPayoff)} ledger points">
        <span>LEDGER</span>
        <b>${formatSigned(state.handPayoff)}</b>
      </div>
      <div class="hand-result__slashes" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    </div>
  `;
}

function rulerTicks(count = 24): string {
  return Array.from({ length: count }, (_, index) => {
    const className = index % 6 === 0 ? "tick tick--major" : index % 3 === 0 ? "tick tick--mid" : "tick";
    return `<span class="${className}"></span>`;
  }).join("");
}

function cardMarkup(player: Player, hidden: boolean): string {
  const card = playerCard(player);
  const owner = actorName(player);
  const dealtClass = state.actions.length === 0 && state.phase === "active" ? "playing-card--dealt" : "";
  const thinkingClass = hidden && state.aiThinking ? "playing-card--thinking" : "";
  if (hidden) {
    return `
      <div class="playing-card playing-card--back ${dealtClass} ${thinkingClass}" aria-label="${owner} card, hidden">
        <span class="card-corner">SEALED</span>
        <img src="./povvo-logo.png" alt="" />
        <span class="card-code">POVVO / 01</span>
        <span class="registration-cross registration-cross--card" aria-hidden="true"></span>
      </div>
    `;
  }

  const rank = cardLabel(card);
  const name = card === 1 ? "JACK" : card === 2 ? "QUEEN" : "KING";
  return `
    <div class="playing-card playing-card--face ${dealtClass} ${state.revealed ? "playing-card--revealed" : ""}" aria-label="${owner} card, ${name}">
      <span class="card-corner">${rank} / 0${card}</span>
      <strong class="card-rank">${rank}</strong>
      <span class="card-name">${name}</span>
      <div class="card-ticks" aria-hidden="true">${rulerTicks(12)}</div>
      <span class="registration-cross registration-cross--card" aria-hidden="true"></span>
    </div>
  `;
}

function actionLogMarkup(): string {
  const records = state.actions.length
    ? state.actions
        .map(
          (record, index) => `
            <li style="--row:${index}">
              <span>${String(index + 1).padStart(2, "0")}</span>
              <strong>${actorName(record.player)}</strong>
              <b>${record.label}</b>
            </li>
          `,
        )
        .join("")
    : `<li class="action-log__empty"><span>00</span><strong>HAND</strong><b>OPEN</b></li>`;
  return `<ol class="action-log" aria-label="Hand action history">${records}</ol>`;
}

function solverTraceMarkup(): string {
  const decision = state.lastAiDecision;
  if (!decision || !state.revealed) {
    return `
      <div class="policy-seal">
        <span>DECISION TRACE</span>
        <strong>SEALED</strong>
        <small>REVEALS AFTER HAND</small>
      </div>
    `;
  }

  const passive = actionLabel(decision.history, "p");
  const active = actionLabel(decision.history, "b");
  return `
    <div class="policy-trace">
      <div class="policy-trace__head">
        <span>POVVO POLICY / ${cardLabel(decision.card)}|${decision.history || "START"}</span>
        <strong>${actionLabel(decision.history, decision.action)}</strong>
      </div>
      <div class="policy-row">
        <span>${passive}</span>
        <div><i style="width:${(decision.strategy.p * 100).toFixed(2)}%"></i></div>
        <b>${(decision.strategy.p * 100).toFixed(1)}%</b>
      </div>
      <div class="policy-row">
        <span>${active}</span>
        <div><i style="width:${(decision.strategy.b * 100).toFixed(2)}%"></i></div>
        <b>${(decision.strategy.b * 100).toFixed(1)}%</b>
      </div>
    </div>
  `;
}

function actionButtonsMarkup(): string {
  if (state.phase === "settled" || state.phase === "complete") {
    const label = state.phase === "complete" ? "NEW MATCH" : "NEXT HAND";
    return `<button class="spec-button spec-button--primary" type="button" data-next>${label}</button>`;
  }

  const turn = activePlayer(state.history);
  const unavailable = state.phase !== "active" || state.actionLocked || state.aiThinking || turn !== state.humanPosition;
  if (unavailable) {
    return `
      <button class="spec-button" type="button" disabled>CHECK</button>
      <button class="spec-button" type="button" disabled>BET</button>
    `;
  }

  const history = state.history as DecisionHistory;
  return `
    <button class="spec-button" type="button" data-action="p">${actionLabel(history, "p")}</button>
    <button class="spec-button" type="button" data-action="b">${actionLabel(history, "b")}</button>
  `;
}

function render(focusPrimary = false): void {
  const status = statusCopy();
  const humanCard = playerCard(state.humanPosition);
  const scorePosition = ((state.humanScore + MATCH_TARGET) / (MATCH_TARGET * 2)) * 100;
  const active = activePlayer(state.history);

  app.innerHTML = `
    <div class="game-shell">
      <header class="masthead">
        <a class="brand-lockup" href="../" aria-label="Return to the Povvo profile">
          <span class="wordmark-crop" role="img" aria-label="POVVO">
            <img src="./povvo-banner.png" alt="" />
          </span>
        </a>
        <div class="masthead-title">
          <h1>POKER / 1V1</h1>
          <span>KUHN FIELD / DCFR OPPONENT</span>
        </div>
        <div class="masthead-ruler" aria-hidden="true">${rulerTicks(30)}</div>
        <button class="icon-button" type="button" data-rules aria-label="Open game rules" title="Game rules">
          <span aria-hidden="true">?</span><small>RULES</small>
        </button>
        <button class="icon-button" type="button" data-reset aria-label="Reset match" title="Reset match">
          <span aria-hidden="true">&#8635;</span><small>RESET</small>
        </button>
      </header>

      <main class="game-layout">
        <aside class="match-rail" aria-label="Match and solver information">
          <div class="rail-heading">
            <span>MATCH LEDGER</span>
            <strong>${String(state.hand).padStart(2, "0")}</strong>
          </div>
          <div class="score-pair">
            <div><span>YOU</span><strong>${formatSigned(state.humanScore)}</strong></div>
            <div><span>POVVO</span><strong>${formatSigned(-state.humanScore)}</strong></div>
          </div>
          <div class="score-ruler" aria-label="Match score, first to seven">
            <span class="score-ruler__marker" style="left:${scorePosition}%"></span>
            <i></i>
            <div><span>−7</span><span>0</span><span>+7</span></div>
          </div>
          <dl class="solver-index">
            <div><dt>ENGINE</dt><dd>${solverMetadata.algorithm}</dd></div>
            <div><dt>ITERATIONS</dt><dd>${solverMetadata.iterations.toLocaleString()}</dd></div>
            <div><dt>EXPLOIT</dt><dd>${solverMetadata.exploitability.toFixed(4)}</dd></div>
            <div><dt>GAME VALUE</dt><dd>${solverMetadata.gameValue.toFixed(4)}</dd></div>
          </dl>
          <div class="rules-index" aria-label="Kuhn Poker structure">
            <span>J &lt; Q &lt; K</span>
            <span>ANTE 01</span>
            <span>BET 01</span>
          </div>
          <span class="registration-cross registration-cross--rail" aria-hidden="true"></span>
        </aside>

        <section class="table-stage" aria-label="Povvo Poker table">
          <img class="identity-underlay" src="./povvo-banner.png" alt="" />

          <section class="seat seat--povvo ${active === aiPosition() ? "seat--active" : ""}" aria-label="Povvo seat">
            <div class="seat-label seat-label--inverse">
              <span>POVVO / ${aiPosition() === 0 ? "OPEN" : "RESPONSE"}</span>
              <strong>${state.aiThinking ? "INSPECTING" : state.actionLocked && active === aiPosition() ? "RECEIVING" : active === aiPosition() ? "ACTING" : "LOCKED"}</strong>
            </div>
            ${cardMarkup(aiPosition(), !state.revealed)}
            ${solverTraceMarkup()}
          </section>

          <div class="pot-field" aria-label="Pot contains ${potForHistory(state.history)} units">
            <div class="pot-ruler" aria-hidden="true">${rulerTicks(16)}</div>
            <div class="pot-stack" aria-hidden="true">
              ${Array.from({ length: potForHistory(state.history) }, (_, index) => `<i style="--chip:${index}"></i>`).join("")}
            </div>
            <span>POT</span>
            <strong>${String(potForHistory(state.history)).padStart(2, "0")}</strong>
          </div>

          <section class="seat seat--human ${active === state.humanPosition && state.phase === "active" ? "seat--active" : ""}" aria-label="Your seat">
            <div class="seat-label">
              <span>YOU / ${state.humanPosition === 0 ? "OPEN" : "RESPONSE"}</span>
              <strong>${state.phase === "active" && !state.actionLocked && active === state.humanPosition ? "YOUR ACTION" : `CARD ${cardLabel(humanCard)}`}</strong>
            </div>
            ${cardMarkup(state.humanPosition, false)}
            ${actionLogMarkup()}
          </section>

          ${resultMarkup()}
        </section>
      </main>

      <footer class="action-rail">
        <div class="turn-status" aria-live="${state.phase === "settled" || state.phase === "complete" ? "off" : "polite"}">
          <span>${status.eyebrow}</span>
          <strong>${status.title}</strong>
          <small>${status.detail}</small>
        </div>
        <div class="action-buttons">${actionButtonsMarkup()}</div>
        <div class="slash-signature" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <span class="registration-cross registration-cross--footer" aria-hidden="true"></span>
      </footer>
    </div>

    <dialog class="rules-dialog" id="rules-dialog" aria-labelledby="rules-title">
      <div class="dialog-index">RULE SET / KUHN 1950</div>
      <h2 id="rules-title">THREE CARDS. ONE BET.</h2>
      <p>Each player antes one unit and receives one card from J, Q, K. Check or bet. Facing a bet, fold or call. Highest card wins a showdown. Position alternates every hand; first to seven ledger points takes the match.</p>
      <div class="rules-diagram" aria-label="Card order Jack, Queen, King">
        <span>J</span><i></i><span>Q</span><i></i><span>K</span>
      </div>
      <form method="dialog"><button class="spec-button spec-button--primary" type="submit">CLOSE</button></form>
    </dialog>
  `;

  bindControls();
  if (focusPrimary && keyboardNavigation) {
    window.requestAnimationFrame(() => {
      app.querySelector<HTMLButtonElement>("[data-action], [data-next]")?.focus();
    });
  }
}

function bindControls(): void {
  app.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
    button.addEventListener("click", () => commitAction(state.humanPosition, button.dataset.action as ActionCode));
  });
  app.querySelector<HTMLButtonElement>("[data-next]")?.addEventListener("click", () => {
    if (state.phase === "complete") resetMatch();
    else nextHand();
  });
  app.querySelector<HTMLButtonElement>("[data-reset]")?.addEventListener("click", resetMatch);
  app.querySelector<HTMLButtonElement>("[data-rules]")?.addEventListener("click", () => {
    app.querySelector<HTMLDialogElement>("#rules-dialog")?.showModal();
  });
  bindCardTilt();
}

function bindCardTilt(): void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (reducedMotion || !finePointer) return;

  app.querySelectorAll<HTMLElement>(".playing-card").forEach((card) => {
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    card.addEventListener("pointermove", (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (frame) return;

      frame = window.requestAnimationFrame(() => {
        const bounds = card.getBoundingClientRect();
        const x = (pointerX - bounds.left) / bounds.width;
        const y = (pointerY - bounds.top) / bounds.height;
        card.style.setProperty("--tilt-x", `${((0.5 - y) * 5).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${((x - 0.5) * 7).toFixed(2)}deg`);
        card.style.setProperty("--scan-y", `${(y * 100).toFixed(1)}%`);
        frame = 0;
      });
    });
    card.addEventListener("pointerleave", () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
      card.style.setProperty("--scan-y", "50%");
    });
  });
}

document.addEventListener("keydown", (event) => {
  keyboardNavigation = true;
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  const dialog = app.querySelector<HTMLDialogElement>("#rules-dialog");
  if (dialog?.open) return;

  if (event.key === "1" || event.key === "2") {
    const action: ActionCode = event.key === "1" ? "p" : "b";
    const button = app.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
    button?.click();
  }
  if (event.key.toLowerCase() === "n") app.querySelector<HTMLButtonElement>("[data-next]")?.click();
});

document.addEventListener("pointerdown", () => {
  keyboardNavigation = false;
});

advanceTurn();
