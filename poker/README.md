# Povvo Poker

A compact 1v1 Kuhn Poker game played against a deterministic DCFR policy in the Povvo design language.

## Solver provenance

`solver/toy_dcfr.lua` is the release-safe Kuhn Poker proof from The Adviser. The build executes that Lua source through Wasmoon for 10,000 DCFR iterations, validates its checksum and game-theoretic metrics, then exports the policy consumed by the browser game.

The production Adviser model, range abstraction, application integration, and private implementation details are not included.

## Run locally

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The local server prints its URL after the policy export completes.

## Validate

```powershell
pnpm test
pnpm build
```

The production build fails if the source checksum, policy distributions, known Kuhn game value, or exploitability gates drift.

## Play

Each player antes one point and receives one card from J, Q, and K. Players may check or bet; after a bet, the response is fold or call. The highest card wins at showdown. Position alternates each hand, and the first side to lead the ledger by seven points wins the match.

Use the visible controls or press `1` and `2` for the available actions. Press `N` for the next hand.
