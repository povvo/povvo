# Ethan Lee Barrett, public work

The site at [povvo.github.io/povvo](https://povvo.github.io/povvo/) shows every public repository as a case on a revolving rack. Turn the rack, take a case out, and open it to read its README.

The design language is "Heat Sheet". It brings together Jonathan Zawada's *Hi This Is Flume* artwork and four pastiche extractions:
- a sun-bleached heat field with the rack standing on its horizon;
- glossy cases with generated patchwork covers;
- each project's title set huge behind its case;
- a full-screen tracklist index;
- everything set on one twelve-column grid.

The records are in [`recipe/`](recipe/). Start with [`recipe/direction-v2.md`](recipe/direction-v2.md), then [`recipe/critique-v2.md`](recipe/critique-v2.md) for the composition pass.

## Run

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

- `pnpm build` type-checks and builds to `dist/`.
- `pnpm data` refreshes `public/data/repos.json` from the GitHub API. It uses `GITHUB_TOKEN` when set and keeps the committed snapshot on any failure.

## How the catalogue is built

- **No manual updates.** The committed snapshot paints first. The browser then reads every page of public repositories for `povvo` from the GitHub API, caches the result for an hour, and replaces the snapshot. The weekly deploy also refreshes the snapshot. A repository appears on the rack as soon as it is public. Forks and the profile repositories (`.github`, `povvo`) are excluded.
- **Numbers and codes.** The rack, the edge rail and the tracklist number cases by position in the current order. Covers carry a volume number: the order in which the work was started. Each case has a capsule code built from its language and year, such as `ELB-PY-26`.
- **Covers.** Covers, spines, inside sheets and disc labels are drawn to canvas from the repository data, using the tile system in `src/tiles.ts` and the cover layouts in `src/covers.ts`. The same project always gets the same patchwork, and there is no artwork to maintain.
- **READMEs.** A README is fetched from `raw.githubusercontent.com` when a case opens. It is rendered with `marked` and sanitised with DOMPurify, with repository-relative links and images resolved to GitHub.

## Controls

**Keyboard**
- The arrow keys turn the rack.
- Home and End jump to the first or last case.
- Enter opens a case and Esc closes it.

**Pointer**
- The wheel and a sideways drag turn the rack.
- Dragging the case that is out tilts it; tapping it opens it.

**Index**
- Index in the header (or the `I` key) opens the full-screen tracklist, which is the same list as the rack.
- Type to find a project, choose an order, or pick a row. On a mouse, a cover follows the pointer over each row.
- Previous and Next in the right-hand column name the neighbouring projects.

**Other**
- "Motion" in the header reduces motion, and the system preference is honoured by default. With a mouse and full motion, the cursor says what a press will do: Drag, Open or View.
- On phones, the rack takes sideways swipes and the page scrolls vertically.

## Review

These need Playwright reachable through `NODE_PATH` or `node_modules`.

- `node scripts/review.mjs` serves `dist/` and captures representative states. External reads are fetched through `curl` so that READMEs load in containers with an HTTP proxy.
- `node scripts/contact-sheet.mjs` composes the frames into `recipe/evidence/contact-sheet.jpg`.
- `node scripts/measure-layout.mjs <out.json>` records the settled view's chrome boxes for `infer_alignment_axes.py`.
- `node --experimental-strip-types scripts/simulate-gates.ts` runs the stage's own springs and gates through interruption scenarios and checks clearance, exclusivity and order.

Query parameters for review and weak devices:

| Parameter | Effect |
|---|---|
| `?stress=60` | Synthetic catalogue |
| `?renderer=flat` | No-WebGL fallback |
| `?quality=low` | Low quality tier |
| `?review=1` | Exposes `window.__rack.snap()`, plus `freeze()` and `step(ms)`, a fixed-step clock for sampling motion |
| `?coat=` and `?key=` | Look wedges |
