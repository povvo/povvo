# Ethan Lee Barrett, a catalogue of public work

The site at [povvo.github.io/povvo](https://povvo.github.io/povvo/): every public repository as a case on a revolving rack. Turn the rack, take a case out, open it to read its README.

The direction, visual system, skill application and review records are in [`recipe/`](recipe/). Start with [`recipe/direction.md`](recipe/direction.md).

## Run

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm build` type-checks and builds to `dist/`. `pnpm data` refreshes `public/data/repos.json` from the GitHub API (uses `GITHUB_TOKEN` when set; keeps the committed snapshot on any failure).

## How the catalogue is built

- The committed snapshot paints first. The browser then reads the public GitHub API for `povvo`, caches the result for an hour, and replaces the snapshot. Forks and the profile repositories (`.github`, `povvo`) are excluded.
- Each repository gets an accession number from its creation date. That number is printed on the spine, the insert, the index line and the booklet, and nowhere else.
- READMEs are fetched from `raw.githubusercontent.com` when a case opens, rendered with `marked`, sanitised with DOMPurify, with repository-relative links and images resolved to GitHub.
- Covers, spines and inside faces are drawn to canvas from the repository data; there is no artwork to maintain.

## Controls

Arrow keys turn the rack, Enter opens, Esc closes, Home and End jump. The wheel and a drag turn the rack; dragging the extracted case tilts it; tapping it opens it. The index on the right is the same list as the rack: type to find, choose an order, click a line. The footer control reduces motion; the system preference is honoured by default.

## Review

`node scripts/review.mjs` serves `dist/` and captures representative states with Playwright (needs Playwright reachable through `NODE_PATH` or `node_modules`). `node scripts/contact-sheet.mjs` composes the frames into `recipe/evidence/contact-sheet.jpg`. Query parameters for review and weak devices: `?stress=60` (synthetic catalogue), `?renderer=flat`, `?quality=low`, `?review=1` (exposes `window.__rack.snap()`), `?coat=` and `?key=` (look wedges).
