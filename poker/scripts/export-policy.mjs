import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { LuaFactory } from "wasmoon";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOLVER_PATH = resolve(ROOT, "solver", "toy_dcfr.lua");
const OUTPUT_PATH = resolve(ROOT, "src", "game", "kuhn-policy.generated.json");
const EXPECTED_SOURCE_SHA256 =
  "091191fae5c7aa6f85327dbf101bfb58dbe8f7d39a151570182ad4aa262e8920";
const ITERATIONS = 10_000;

const COMPATIBILITY_MODULES = String.raw`
math.pow = math.pow or function(base, exponent) return base ^ exponent end

package.preload['sci.stat'] = function()
  return {
    olmean = function(initial)
      local value = { n = 0, mu = initial or 0 }
      function value:push(sample)
        self.n = self.n + 1
        self.mu = self.mu + (sample - self.mu) / self.n
      end
      function value:mean() return self.mu end
      function value:len() return self.n end
      return value
    end,
  }
end

package.preload['sci.prng'] = function()
  return {
    lfib4 = function()
      return { source = 'unused-by-exhaustive-kuhn-traversal' }
    end,
  }
end
`;

const source = (await readFile(SOLVER_PATH, "utf8")).replace(/\r\n?/g, "\n");
const sourceSha256 = createHash("sha256").update(source).digest("hex");

if (sourceSha256 !== EXPECTED_SOURCE_SHA256) {
  throw new Error(
    `Solver checksum mismatch: expected ${EXPECTED_SOURCE_SHA256}, received ${sourceSha256}`,
  );
}

const factory = new LuaFactory();
const lua = await factory.createEngine();

try {
  const result = await lua.doString(`${COMPATIBILITY_MODULES}
local toy = (function()
${source}
end)()

local tracker = toy.newConvergenceTracker()
local store = toy.solveKuhn(${ITERATIONS}, tracker)
local histories = {'', 'p', 'b', 'pb'}
local policy = {}

for card = 1, 3 do
  for _, history in ipairs(histories) do
    local key = tostring(card) .. '|' .. history
    local average = toy._getAverageStrategy(store[key])
    policy[key] = { p = average[1], b = average[2] }
  end
end

return {
  gameValue = toy.kuhnGameValue(store),
  exploitability = toy.kuhnExploitability(store),
  convergenceMean = tracker:mean(),
  checkpoints = tracker.checkpoints,
  policy = policy,
}
`);
  const gameValue = Number(result.gameValue);
  const exploitability = Number(result.exploitability);
  const historyOrder = new Map([
    ["", 0],
    ["p", 1],
    ["b", 2],
    ["pb", 3],
  ]);
  const policy = Object.fromEntries(
    Object.entries(result.policy)
      .sort(([left], [right]) => {
        const [leftCard, leftHistory] = left.split("|");
        const [rightCard, rightHistory] = right.split("|");
        return (
          Number(leftCard) - Number(rightCard) ||
          (historyOrder.get(leftHistory) ?? 99) - (historyOrder.get(rightHistory) ?? 99)
        );
      })
      .map(([key, strategy]) => [key, { p: Number(strategy.p), b: Number(strategy.b) }]),
  );

  for (const [key, strategy] of Object.entries(policy)) {
    const p = Number(strategy.p);
    const b = Number(strategy.b);
    const total = p + b;

    if (!Number.isFinite(p) || !Number.isFinite(b) || Math.abs(total - 1) > 1e-9) {
      throw new Error(`Invalid strategy distribution for ${key}: ${p}, ${b}`);
    }
  }

  if (Math.abs(gameValue + 1 / 18) > 0.01) {
    throw new Error(`Kuhn game value failed validation: ${gameValue}`);
  }

  if (exploitability >= 0.01) {
    throw new Error(`Kuhn exploitability failed validation: ${exploitability}`);
  }

  const checkpoints = Array.from(result.checkpoints ?? []).map((point) => ({
    iteration: Number(point.iteration),
    exploitability: Number(point.exploitability),
  }));
  const payload = {
    solver: {
      algorithm: "DCFR",
      parameters: { alpha: 1.5, beta: 0, gamma: 2 },
      iterations: ITERATIONS,
      source: "solver/toy_dcfr.lua",
      sourceSha256,
      gameValue,
      exploitability,
      convergenceMean: Number(result.convergenceMean),
      checkpoints,
    },
    policy,
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Kuhn policy: ${ITERATIONS} DCFR iterations, value ${gameValue.toFixed(6)}, exploitability ${exploitability.toFixed(6)}\n`,
  );
} finally {
  lua.global.close();
}
