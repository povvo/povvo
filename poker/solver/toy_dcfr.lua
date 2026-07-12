-- engines/test/toy_dcfr.lua
-- Standalone DCFR solver for abstract toy poker games (Kuhn, AKQ, Leduc).
-- Shares the EXACT same DCFR update math as cfr_solver.lua (ETH-6):
--   α=1.5, β=0, γ=2 (Brown & Sandholm, AAAI 2019)
-- but operates on abstract info sets (card + action history) rather than
-- real poker hand combos. This isolates the algorithm validation from
-- the card-encoding and tree-building logic of the production solver.
--
-- SciLua integration:
--   sci.stat.olmean(0) — Welford online mean for O(1) convergence tracking
--   sci.prng.lfib4()   — deterministic PRNG for reproducible test seeding
--   Standard math.pow/max retained for DCFR discounts (LuaJIT trace-compiles
--   these to native machine code; wrapping in sci.math adds no benefit).
--
-- Created for: ETH-7 (Validate DCFR on Kuhn / AKQ / Leduc toy games)
-- Source: Kuhn (1950), Chen & Ankenman (2006), Southey et al. (2005)

local stat = require('sci.stat')
local prng = require('sci.prng')

local M = {}

-- ── Module-level PRNG ─────────────────────────────────────────────────────
-- SciLua LFIB4 (period 2^287, proven equidistribution).
-- The toy solvers enumerate all card deals exhaustively, so this PRNG is
-- not used in CFR traversal. It is exposed for spec-level deterministic
-- seeding via tostring(rng) / prng.restore(state_str).
local _rng = prng.lfib4()
M._rng = _rng

-- ── Convergence Tracker ───────────────────────────────────────────────────
-- O(1) memory online accumulator via Welford's algorithm (sci.stat.olmean).
-- Tracks exploitability measurements without storing full history.
function M.newConvergenceTracker()
  return {
    olmean = stat.olmean(0),
    checkpoints = {},
    push = function(self, iteration, exploitability)
      self.olmean:push(exploitability)
      self.checkpoints[#self.checkpoints + 1] = {
        iteration = iteration,
        exploitability = exploitability,
      }
    end,
    mean = function(self)
      return self.olmean:mean()
    end,
    len = function(self)
      return self.olmean:len()
    end,
  }
end

-- ── Info Set Storage ──────────────────────────────────────────────────────
-- Key: string (card .. '|' .. history), e.g. "3|b"
-- Value: { regret = {}, strategySum = {}, numActions = int }
local function getOrCreateInfoSet(store, key, numActions)
  if not store[key] then
    local r, s = {}, {}
    for a = 1, numActions do r[a] = 0; s[a] = 0 end
    store[key] = { regret = r, strategySum = s, numActions = numActions }
  end
  return store[key]
end

-- ── Regret-Matching on Positive Regrets ──────────────────────────────────
-- Identical to cfr_solver.lua getStrategy: uniform if all regrets ≤ 0.
local function getStrategy(infoSet)
  local n = infoSet.numActions
  local strat = {}
  local sum = 0
  for a = 1, n do
    strat[a] = math.max(0, infoSet.regret[a])
    sum = sum + strat[a]
  end
  if sum > 0 then
    for a = 1, n do strat[a] = strat[a] / sum end
  else
    local u = 1 / n
    for a = 1, n do strat[a] = u end
  end
  return strat
end

-- ── DCFR Discount Factors ────────────────────────────────────────────────
-- Source: Brown & Sandholm, AAAI 2019; d5-math-reference.md lines 82-87.
-- All factors use (t-1), NOT t. At t=1, all yield 0.0 — correctly
-- discarding the zero-initialized state from iteration 0.
-- α=1.5: positive regret discount = (t-1)^1.5 / ((t-1)^1.5 + 1)
-- β=0:   negative regret discount = (t-1)^0 / ((t-1)^0 + 1) = 0.5
-- γ=2:   strategy sum discount    = ((t-1)/t)^2
local function dcfrDiscounts(t)
  if t <= 1 then
    return 0.0, 0.0, 0.0
  end
  local tm1 = t - 1
  local posDiscount = math.pow(tm1, 1.5) / (math.pow(tm1, 1.5) + 1)
  local negDiscount = 0.5  -- (t-1)^0 / ((t-1)^0 + 1) = 1/2 for all t > 1
  local gammaFactor = math.pow(tm1 / t, 2)
  return posDiscount, negDiscount, gammaFactor
end

-- ══════════════════════════════════════════════════════════════════════════
--  KUHN POKER (3 cards: J=1, Q=2, K=3)
-- ══════════════════════════════════════════════════════════════════════════
-- Known game value: P1 = -1/18 ≈ -0.0556 (Kuhn, 1950, Princeton)

local KUHN_DEALS = {
  {1,2},{1,3},{2,1},{2,3},{3,1},{3,2}
}

local function kuhnTerminalPayoff(card1, card2, history)
  if history == 'pp' then return (card1 > card2) and 1 or -1 end
  if history == 'bb' then return (card1 > card2) and 2 or -2 end
  if history == 'bp' then return 1 end
  if history == 'pbp' then return -1 end
  if history == 'pbb' then return (card1 > card2) and 2 or -2 end
  return nil
end

local function kuhnIsTerminal(history)
  return history == 'pp' or history == 'bb' or history == 'bp'
      or history == 'pbp' or history == 'pbb'
end

local function kuhnActivePlayer(history)
  if history == '' then return 0 end
  if history == 'p' then return 1 end
  if history == 'b' then return 1 end
  if history == 'pb' then return 0 end
  return -1
end

local function kuhnActions(history)
  if history == '' then return {'p', 'b'} end
  if history == 'p' then return {'p', 'b'} end
  if history == 'b' then return {'p', 'b'} end
  if history == 'pb' then return {'p', 'b'} end
  return {}
end

local function kuhnCFR(store, card1, card2, history, reachProbs, traverser, iteration)
  if kuhnIsTerminal(history) then
    local payoff = kuhnTerminalPayoff(card1, card2, history)
    return (traverser == 0) and payoff or -payoff
  end

  local player = kuhnActivePlayer(history)
  local card = (player == 0) and card1 or card2
  local infoSetKey = tostring(card) .. '|' .. history
  local actions = kuhnActions(history)
  local numActions = #actions
  local infoSet = getOrCreateInfoSet(store, infoSetKey, numActions)
  local strat = getStrategy(infoSet)

  local actionVals = {}
  local nodeVal = 0

  for a = 1, numActions do
    local newReach = { [0] = reachProbs[0], [1] = reachProbs[1] }
    newReach[player] = reachProbs[player] * strat[a]
    actionVals[a] = kuhnCFR(store, card1, card2, history .. actions[a], newReach, traverser, iteration)
    nodeVal = nodeVal + strat[a] * actionVals[a]
  end

  if player == traverser then
    local posDiscount, negDiscount, gammaFactor = dcfrDiscounts(iteration)
    local opponentReach = reachProbs[1 - player]
    for a = 1, numActions do
      -- Counterfactual regret: weighted by opponent reach probability.
      -- This matches cfr_solver.lua where terminal values are pre-weighted
      -- by opponent reach (iR[j]*oopPayoff). Without this weighting,
      -- regrets from each card deal contribute equally regardless of
      -- opponent likelihood, preventing equilibrium convergence.
      local instRegret = opponentReach * (actionVals[a] - nodeVal)
      local oldRegret = infoSet.regret[a]
      -- DCFR: discount-before-add (ETH-6 spec, Brown & Sandholm 2019)
      if oldRegret > 0 then
        infoSet.regret[a] = (oldRegret * posDiscount) + instRegret
      else
        infoSet.regret[a] = (oldRegret * negDiscount) + instRegret
      end
      infoSet.strategySum[a] = (infoSet.strategySum[a] * gammaFactor) + reachProbs[player] * strat[a]
    end
  end

  return nodeVal
end

function M.solveKuhn(numIterations, tracker)
  local store = {}
  for t = 1, numIterations do
    -- ETH-8: Alternating traverser required for DCFR convergence guarantees
    local traverser = (t - 1) % 2
    for _, cards in ipairs(KUHN_DEALS) do
      kuhnCFR(store, cards[1], cards[2], '', {[0]=1, [1]=1}, traverser, t)
    end
    if tracker and (t % 50 == 0 or t == numIterations) then
      local exploit = M.kuhnExploitability(store)
      tracker:push(t, exploit)
    end
  end
  return store
end

function M._getAverageStrategy(infoSet)
  local n = infoSet.numActions
  local sum = 0
  for a = 1, n do sum = sum + infoSet.strategySum[a] end
  local avg = {}
  if sum > 0 then
    for a = 1, n do avg[a] = infoSet.strategySum[a] / sum end
  else
    local u = 1 / n
    for a = 1, n do avg[a] = u end
  end
  return avg
end

function M.kuhnGameValue(store)
  local totalVal = 0
  for _, cards in ipairs(KUHN_DEALS) do
    totalVal = totalVal + M._kuhnExpectedValue(store, cards[1], cards[2], '')
  end
  return totalVal / #KUHN_DEALS
end

function M._kuhnExpectedValue(store, card1, card2, history)
  if kuhnIsTerminal(history) then
    return kuhnTerminalPayoff(card1, card2, history)
  end
  local player = kuhnActivePlayer(history)
  local card = (player == 0) and card1 or card2
  local infoSetKey = tostring(card) .. '|' .. history
  local actions = kuhnActions(history)
  local infoSet = store[infoSetKey]
  if not infoSet then return 0 end
  local avgStrat = M._getAverageStrategy(infoSet)
  local val = 0
  for a = 1, #actions do
    val = val + avgStrat[a] * M._kuhnExpectedValue(store, card1, card2, history .. actions[a])
  end
  return val
end

-- Kuhn exploitability: reach-weighted best response (imperfect information)
-- BR player sees only their own card. Opponent reach narrows through the tree
-- as the opponent's per-hand strategy filters their range at each action node.
function M.kuhnExploitability(store)
  local CARDS = {1, 2, 3}
  local brSum = 0
  for brPlayer = 0, 1 do
    for _, myCard in ipairs(CARDS) do
      -- Initialize opponent reach as PROBABILITY distribution: P(opp_card | my_card).
      -- In Kuhn (3 cards), given BR player holds myCard, opponent has 2 equally likely
      -- cards, each with prior P = 1/2. Starting at 1.0 doubles all terminal payoffs.
      local oppReach = {}
      for _, oppCard in ipairs(CARDS) do
        if oppCard ~= myCard then oppReach[oppCard] = 0.5 end
      end
      brSum = brSum + M._kuhnBR(store, brPlayer, myCard, '', oppReach)
    end
  end
  -- 3 cards per player, 2 players. Exploitability = average BR advantage.
  return brSum / (2 * 3)
end

function M._kuhnBR(store, brPlayer, myCard, history, oppReach)
  if kuhnIsTerminal(history) then
    -- Sum terminal payoffs weighted by opponent reach
    local val = 0
    for oppCard, reach in pairs(oppReach) do
      if reach > 0 then
        local c1 = (brPlayer == 0) and myCard or oppCard
        local c2 = (brPlayer == 0) and oppCard or myCard
        local payoff = kuhnTerminalPayoff(c1, c2, history)
        payoff = (brPlayer == 0) and payoff or -payoff
        val = val + reach * payoff
      end
    end
    return val
  end

  local player = kuhnActivePlayer(history)
  local actions = kuhnActions(history)

  if player == brPlayer then
    -- BR player: pick the action that maximises EV (same choice for all opponent cards)
    local best = -math.huge
    for a = 1, #actions do
      local val = M._kuhnBR(store, brPlayer, myCard, history .. actions[a], oppReach)
      if val > best then best = val end
    end
    return best
  else
    -- Opponent: follow average strategy, narrow reach per-hand
    local totalVal = 0
    for a = 1, #actions do
      local newOppReach = {}
      for oppCard, reach in pairs(oppReach) do
        if reach > 0 then
          local key = tostring(oppCard) .. '|' .. history
          local infoSet = store[key]
          local avg = infoSet and M._getAverageStrategy(infoSet) or {0.5, 0.5}
          newOppReach[oppCard] = reach * avg[a]
        end
      end
      totalVal = totalVal + M._kuhnBR(store, brPlayer, myCard, history .. actions[a], newOppReach)
    end
    return totalVal
  end
end


-- ══════════════════════════════════════════════════════════════════════════
--  AKQ HALF-STREET (3 cards: Q=1, K=2, A=3)
-- ══════════════════════════════════════════════════════════════════════════
-- Known game value: P2 EV = +1/18 (Chen & Ankenman, 2006)

local AKQ_DEALS = {
  {1,2},{1,3},{2,1},{2,3},{3,1},{3,2}
}

local function akqTerminalPayoff(card1, card2, history)
  if history == 'xp' then return (card1 > card2) and 1 or -1 end
  if history == 'xbp' then return -1 end
  if history == 'xbb' then return (card1 > card2) and 2 or -2 end
  return nil
end

local function akqIsTerminal(history)
  return history == 'xp' or history == 'xbp' or history == 'xbb'
end

local function akqActivePlayer(history)
  if history == 'x' then return 1 end
  if history == 'xb' then return 0 end
  return -1
end

local function akqActions(history)
  if history == 'x' then return {'p', 'b'} end
  if history == 'xb' then return {'p', 'b'} end
  return {}
end

local function akqCFR(store, card1, card2, history, reachProbs, traverser, iteration)
  if akqIsTerminal(history) then
    local payoff = akqTerminalPayoff(card1, card2, history)
    return (traverser == 0) and payoff or -payoff
  end
  local player = akqActivePlayer(history)
  if player == -1 then return 0 end
  local card = (player == 0) and card1 or card2
  local infoSetKey = tostring(card) .. '|' .. history
  local actions = akqActions(history)
  local numActions = #actions
  local infoSet = getOrCreateInfoSet(store, infoSetKey, numActions)
  local strat = getStrategy(infoSet)

  local actionVals = {}
  local nodeVal = 0
  for a = 1, numActions do
    local newReach = { [0] = reachProbs[0], [1] = reachProbs[1] }
    newReach[player] = reachProbs[player] * strat[a]
    actionVals[a] = akqCFR(store, card1, card2, history .. actions[a], newReach, traverser, iteration)
    nodeVal = nodeVal + strat[a] * actionVals[a]
  end

  if player == traverser then
    local posDiscount, negDiscount, gammaFactor = dcfrDiscounts(iteration)
    local opponentReach = reachProbs[1 - player]
    for a = 1, numActions do
      local instRegret = opponentReach * (actionVals[a] - nodeVal)
      local oldRegret = infoSet.regret[a]
      if oldRegret > 0 then
        infoSet.regret[a] = (oldRegret * posDiscount) + instRegret
      else
        infoSet.regret[a] = (oldRegret * negDiscount) + instRegret
      end
      infoSet.strategySum[a] = (infoSet.strategySum[a] * gammaFactor) + reachProbs[player] * strat[a]
    end
  end
  return nodeVal
end

function M.solveAKQ(numIterations, tracker)
  local store = {}
  for t = 1, numIterations do
    local traverser = (t - 1) % 2
    for _, cards in ipairs(AKQ_DEALS) do
      akqCFR(store, cards[1], cards[2], 'x', {[0]=1, [1]=1}, traverser, t)
    end
    if tracker and (t % 50 == 0 or t == numIterations) then
      local exploit = M.akqExploitability(store)
      tracker:push(t, exploit)
    end
  end
  return store
end

function M.akqGameValue(store)
  local totalVal = 0
  for _, cards in ipairs(AKQ_DEALS) do
    totalVal = totalVal + M._akqExpectedValue(store, cards[1], cards[2], 'x')
  end
  return totalVal / #AKQ_DEALS
end

function M._akqExpectedValue(store, card1, card2, history)
  if akqIsTerminal(history) then
    return akqTerminalPayoff(card1, card2, history)
  end
  local player = akqActivePlayer(history)
  if player == -1 then return 0 end
  local card = (player == 0) and card1 or card2
  local infoSetKey = tostring(card) .. '|' .. history
  local actions = akqActions(history)
  local infoSet = store[infoSetKey]
  if not infoSet then return 0 end
  local avgStrat = M._getAverageStrategy(infoSet)
  local val = 0
  for a = 1, #actions do
    val = val + avgStrat[a] * M._akqExpectedValue(store, card1, card2, history .. actions[a])
  end
  return val
end

function M.akqExploitability(store)
  local CARDS = {1, 2, 3}
  local brSum = 0
  for brPlayer = 0, 1 do
    for _, myCard in ipairs(CARDS) do
      local oppReach = {}
      for _, oppCard in ipairs(CARDS) do
        if oppCard ~= myCard then oppReach[oppCard] = 0.5 end
      end
      brSum = brSum + M._akqBR(store, brPlayer, myCard, 'x', oppReach)
    end
  end
  return brSum / (2 * 3)
end

function M._akqBR(store, brPlayer, myCard, history, oppReach)
  if akqIsTerminal(history) then
    local val = 0
    for oppCard, reach in pairs(oppReach) do
      if reach > 0 then
        local c1 = (brPlayer == 0) and myCard or oppCard
        local c2 = (brPlayer == 0) and oppCard or myCard
        local payoff = akqTerminalPayoff(c1, c2, history)
        payoff = (brPlayer == 0) and payoff or -payoff
        val = val + reach * payoff
      end
    end
    return val
  end

  local player = akqActivePlayer(history)
  if player == -1 then return 0 end
  local actions = akqActions(history)

  if player == brPlayer then
    local best = -math.huge
    for a = 1, #actions do
      local val = M._akqBR(store, brPlayer, myCard, history .. actions[a], oppReach)
      if val > best then best = val end
    end
    return best
  else
    local totalVal = 0
    for a = 1, #actions do
      local newOppReach = {}
      for oppCard, reach in pairs(oppReach) do
        if reach > 0 then
          local key = tostring(oppCard) .. '|' .. history
          local infoSet = store[key]
          local avg = infoSet and M._getAverageStrategy(infoSet) or {0.5, 0.5}
          newOppReach[oppCard] = reach * avg[a]
        end
      end
      totalVal = totalVal + M._akqBR(store, brPlayer, myCard, history .. actions[a], newOppReach)
    end
    return totalVal
  end
end


-- ══════════════════════════════════════════════════════════════════════════
--  LEDUC POKER (6 cards: J1, J2, Q1, Q2, K1, K2; 2 rounds)
-- ══════════════════════════════════════════════════════════════════════════
-- Deck: 2 Jacks, 2 Queens, 2 Kings. Ante 1 each.
-- Round 1: bet size = 2, max 1 bet. Round 2: bet size = 4, max 1 bet.
-- Community card dealt between rounds. Pair with board > high card.
-- Source: Southey et al. (2005), standard CFR testbed.

local LEDUC_CARDS = {1, 1, 2, 2, 3, 3}

local function leducCompare(card1, card2, boardCard)
  local pair1 = (card1 == boardCard)
  local pair2 = (card2 == boardCard)
  if pair1 and not pair2 then return 1 end
  if pair2 and not pair1 then return -1 end
  if card1 > card2 then return 1 end
  if card1 < card2 then return -1 end
  return 0
end

local function leducParseHistory(history)
  local slash = history:find('/')
  if slash then
    return history:sub(1, slash - 1), history:sub(slash + 1)
  end
  return history, ''
end

local function leducIsRoundOver(roundHist)
  local len = #roundHist
  if len < 2 then return false, nil end
  local last2 = roundHist:sub(len - 1, len)
  if last2 == 'pp' then return true, 'showdown' end
  if last2 == 'bb' then return true, 'showdown' end
  if last2 == 'bp' then return true, 'fold' end
  return false, nil
end

local function leducPotContribs(history)
  local r1, r2 = leducParseHistory(history)
  local p1, p2 = 1, 1
  for i = 1, #r1 do
    if r1:sub(i, i) == 'b' then
      if (i - 1) % 2 == 0 then p1 = p1 + 2 else p2 = p2 + 2 end
    end
  end
  for i = 1, #r2 do
    if r2:sub(i, i) == 'b' then
      if (i - 1) % 2 == 0 then p1 = p1 + 4 else p2 = p2 + 4 end
    end
  end
  return p1, p2
end

local function leducActions(roundHist)
  local len = #roundHist
  if len == 0 then return {'p', 'b'} end
  local last = roundHist:sub(len, len)
  if last == 'p' and len == 1 then return {'p', 'b'} end
  if last == 'b' then return {'p', 'b'} end
  return {}
end

local function leducCFR(store, card1, card2, boardCard, history, reachProbs, traverser, iteration)
  local r1, r2 = leducParseHistory(history)
  local inRound2 = history:find('/') ~= nil

  -- Terminal checks
  if inRound2 then
    local over, termType = leducIsRoundOver(r2)
    if over then
      local p1inv, p2inv = leducPotContribs(history)
      local payoff
      if termType == 'fold' then
        local folder = (#r2 - 1) % 2
        payoff = (folder == 0) and -p1inv or p2inv
      else
        local cmp = leducCompare(card1, card2, boardCard)
        if cmp > 0 then payoff = p2inv
        elseif cmp < 0 then payoff = -p1inv
        else payoff = 0 end
      end
      return (traverser == 0) and payoff or -payoff
    end
  else
    local over, termType = leducIsRoundOver(r1)
    if over then
      if termType == 'fold' then
        local p1inv, p2inv = leducPotContribs(history)
        local folder = (#r1 - 1) % 2
        local payoff = (folder == 0) and -p1inv or p2inv
        return (traverser == 0) and payoff or -payoff
      end
      -- Round 1 complete → transition to round 2
      return leducCFR(store, card1, card2, boardCard, history .. '/', reachProbs, traverser, iteration)
    end
  end

  local activeHist = inRound2 and r2 or r1
  local actions = leducActions(activeHist)
  if #actions == 0 then return 0 end

  local player = #activeHist % 2
  local card = (player == 0) and card1 or card2

  local infoSetKey
  if inRound2 then
    infoSetKey = tostring(card) .. ':' .. tostring(boardCard) .. '|' .. history
  else
    infoSetKey = tostring(card) .. '|' .. history
  end

  local numActions = #actions
  local infoSet = getOrCreateInfoSet(store, infoSetKey, numActions)
  local strat = getStrategy(infoSet)

  local actionVals = {}
  local nodeVal = 0

  for a = 1, numActions do
    local newReach = { [0] = reachProbs[0], [1] = reachProbs[1] }
    newReach[player] = reachProbs[player] * strat[a]
    actionVals[a] = leducCFR(store, card1, card2, boardCard, history .. actions[a], newReach, traverser, iteration)
    nodeVal = nodeVal + strat[a] * actionVals[a]
  end

  if player == traverser then
    local posDiscount, negDiscount, gammaFactor = dcfrDiscounts(iteration)
    local opponentReach = reachProbs[1 - player]
    for a = 1, numActions do
      local instRegret = opponentReach * (actionVals[a] - nodeVal)
      local oldRegret = infoSet.regret[a]
      if oldRegret > 0 then
        infoSet.regret[a] = (oldRegret * posDiscount) + instRegret
      else
        infoSet.regret[a] = (oldRegret * negDiscount) + instRegret
      end
      infoSet.strategySum[a] = (infoSet.strategySum[a] * gammaFactor) + reachProbs[player] * strat[a]
    end
  end

  return nodeVal
end

function M.solveLeduc(numIterations, tracker)
  local store = {}
  local cards = LEDUC_CARDS
  for t = 1, numIterations do
    local traverser = (t - 1) % 2
    for i = 1, #cards do
      for j = 1, #cards do
        if i ~= j then
          for k = 1, #cards do
            if k ~= i and k ~= j then
              leducCFR(store, cards[i], cards[j], cards[k], '',
                {[0]=1, [1]=1}, traverser, t)
            end
          end
        end
      end
    end
    if tracker and (t % 100 == 0 or t == numIterations) then
      local exploit = M.leducExploitability(store)
      tracker:push(t, exploit)
    end
  end
  return store
end

function M.leducExploitability(store)
  local cards = LEDUC_CARDS
  local brSum = 0
  for brPlayer = 0, 1 do
    for myIdx = 1, #cards do
      -- Initialize oppReach as probability distribution over opponent deck indices.
      -- In Leduc (6 cards), given BR player holds deck index myIdx,
      -- opponent holds one of 5 remaining indices, each with P = 1/5.
      local oppReach = {}
      for j = 1, #cards do
        if j ~= myIdx then oppReach[j] = 1.0 / 5 end
      end
      brSum = brSum + M._leducBR(store, brPlayer, myIdx, '', oppReach, nil)
    end
  end
  -- 6 deck indices per player, 2 players.
  return brSum / (2 * #cards)
end

-- Imperfect-information best response for Leduc poker.
-- myIdx: BR player's deck index (1-6). oppReach: {deckIdx → probability}.
-- boardIdx: nil in round 1, set to deck index after chance node deals board.
-- At chance nodes (round transition), marginalizes over all possible board cards.
-- At opponent nodes, narrows oppReach by opponent's average strategy per-hand.
-- At BR player nodes, picks action maximizing EV against oppReach distribution.
function M._leducBR(store, brPlayer, myIdx, history, oppReach, boardIdx)
  local r1, r2 = leducParseHistory(history)
  local inRound2 = history:find('/') ~= nil
  local myCard = LEDUC_CARDS[myIdx]
  local boardCard = boardIdx and LEDUC_CARDS[boardIdx] or nil

  -- Round 2 terminal
  if inRound2 then
    local over, termType = leducIsRoundOver(r2)
    if over then
      local val = 0
      local p1inv, p2inv = leducPotContribs(history)
      for oppIdx, reach in pairs(oppReach) do
        if reach > 0 then
          local payoff
          if termType == 'fold' then
            local folder = (#r2 - 1) % 2
            payoff = (folder == 0) and -p1inv or p2inv
          else
            local oppCard = LEDUC_CARDS[oppIdx]
            local c1 = (brPlayer == 0) and myCard or oppCard
            local c2 = (brPlayer == 0) and oppCard or myCard
            local cmp = leducCompare(c1, c2, boardCard)
            if cmp > 0 then payoff = p2inv
            elseif cmp < 0 then payoff = -p1inv
            else payoff = 0 end
          end
          payoff = (brPlayer == 0) and payoff or -payoff
          val = val + reach * payoff
        end
      end
      return val
    end
  else
    -- Round 1 terminal
    local over, termType = leducIsRoundOver(r1)
    if over then
      if termType == 'fold' then
        -- Fold payoff is card-independent: sum oppReach * payoff
        local p1inv, p2inv = leducPotContribs(history)
        local folder = (#r1 - 1) % 2
        local payoff = (folder == 0) and -p1inv or p2inv
        payoff = (brPlayer == 0) and payoff or -payoff
        local oppSum = 0
        for _, reach in pairs(oppReach) do oppSum = oppSum + reach end
        return oppSum * payoff
      end
      -- CHANCE NODE: Round 1 complete → deal board card.
      -- Marginalize over all possible board card indices.
      -- For board index k: filter oppReach to exclude opp==k (can't deal
      -- the same card as both opponent and board). Weight by the remaining
      -- oppReach mass, which represents P(board=k) marginalized over opponent.
      local val = 0
      local totalWeight = 0
      for k = 1, #LEDUC_CARDS do
        if k ~= myIdx then
          local filteredReach = {}
          local weight = 0
          for oppIdx, reach in pairs(oppReach) do
            if oppIdx ~= k then
              filteredReach[oppIdx] = reach
              weight = weight + reach
            end
          end
          if weight > 0 then
            val = val + weight * M._leducBR(store, brPlayer, myIdx, history .. '/', filteredReach, k)
            totalWeight = totalWeight + weight
          end
        end
      end
      if totalWeight > 0 then return val / totalWeight end
      return 0
    end
  end

  -- Decision node
  local activeHist = inRound2 and r2 or r1
  local actions = leducActions(activeHist)
  if #actions == 0 then return 0 end

  local player = #activeHist % 2

  if player == brPlayer then
    -- BR player: pick the action maximizing EV against oppReach distribution.
    -- Same decision for all possible opponent cards (imperfect information).
    local best = -math.huge
    for a = 1, #actions do
      local val = M._leducBR(store, brPlayer, myIdx, history .. actions[a], oppReach, boardIdx)
      if val > best then best = val end
    end
    return best
  else
    -- Opponent: follow average strategy, narrow oppReach per-hand.
    -- Each opponent hand updates reach based on its own info set strategy.
    local totalVal = 0
    for a = 1, #actions do
      local newOppReach = {}
      for oppIdx, reach in pairs(oppReach) do
        if reach > 0 then
          local oppCard = LEDUC_CARDS[oppIdx]
          local key
          if inRound2 then
            key = tostring(oppCard) .. ':' .. tostring(boardCard) .. '|' .. history
          else
            key = tostring(oppCard) .. '|' .. history
          end
          local infoSet = store[key]
          local avg = infoSet and M._getAverageStrategy(infoSet) or {0.5, 0.5}
          newOppReach[oppIdx] = reach * avg[a]
        end
      end
      totalVal = totalVal + M._leducBR(store, brPlayer, myIdx, history .. actions[a], newOppReach, boardIdx)
    end
    return totalVal
  end
end

return M
