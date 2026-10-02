# Ethan Lee Barrett, public work

The site at [povvo.github.io/povvo](https://povvo.github.io/povvo/) shows every public repository as a 3.5" floppy disk in a box. Flip through the box, take a disk out, and put it in the drive to read its README.

The look is black metal and Helvetica:
- every project gets a hand-drawn black metal logo, generated from its name with no font underneath;
- each disk's label is a photocopied night photograph, as on a demo;
- everything readable is set in Helvetica, white on a black page;
- the README comes up on a white photocopied sheet with a drive down its edge;
- now and then the whole page flickers to its negative.

A quick boot screen draws the first view off the main thread and caches it for next time. Sound, synthesised in the browser, is there if you turn it on.

The disks, the boot and the polish are recorded in [`recipe/direction-v4.md`](recipe/direction-v4.md), and the look in [`recipe/direction-v3.md`](recipe/direction-v3.md). The plain baseline it was built from is in [`recipe/baseline.md`](recipe/baseline.md). The earlier "Heat Sheet" language is in [`recipe/direction-v2.md`](recipe/direction-v2.md), with its code set aside in [`parked/`](parked/).

## Run

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

- `pnpm build` type-checks and builds to `dist/`.
- `pnpm data` refreshes `public/data/repos.json` from the GitHub API. It uses `GITHUB_TOKEN` when set and keeps the committed snapshot on any failure.

## How the catalogue is built

- **No manual updates.** The committed snapshot paints first. The browser then reads every page of public repositories for `povvo` from the GitHub API, caches the result for an hour, and replaces the snapshot. The weekly deploy also refreshes the snapshot. A repository appears in the box as soon as it is public. Forks and the profile repositories (`.github`, `povvo`) are excluded.
- **Numbers.** The caption, the sheet and the index number disks by position in the current order. The default order is the order in which the work was started.
- **Logos and labels.** Each project's logo is grown from its name by `src/logo.ts`, and its label is drawn by `src/labels.ts`, with a photograph from `src/xerox.ts`. The same project always gets the same logo and label, and there is no artwork to maintain.
- **Drawing off the main thread.** Logos and photographs are drawn by a small pool of workers (`src/art/`), and each drawing is kept in Cache Storage, so a second visit decodes instead of drawing. The service worker (`public/sw.js`) keeps the app and the snapshot for offline visits.
- **READMEs.** A README is fetched from `raw.githubusercontent.com` when a disk goes into the drive (or earlier: the settled disk's and its neighbours' are prefetched while the page is idle). It is rendered with `marked` and sanitised with DOMPurify, with repository-relative links and images resolved to GitHub.

## Controls

**Keyboard**
- The arrow keys flip through the box. Page Up and Page Down jump five; Home and End go to the first or last disk.
- Type the start of a name to jump to it.
- Enter puts the disk in the drive and Esc ejects it. `F` turns the disk over.

**Pointer**
- The wheel, a sideways drag, or a drag down towards you flips through the box.
- Hovering a disk in the box lifts it and names it; clicking it takes it out.
- Drag the disk that is out to turn it in your hand, or flick it to spin it. Face down, its write-protect tab clicks.
- Tapping the disk that is out puts it in the drive.

**Index**
- Index in the header (or the `I` key) opens the full-screen list of logos, which is the same list as the box.
- Type to find a project, choose an order, or pick a row.
- Previous and Next in the right-hand column name the neighbouring projects.

**Other**
- "Motion" in the header reduces motion and stops the flicker. The system preference is honoured by default.
- "Sound" turns on the synthesised sounds (and a light vibration on phones). It is off until you ask for it.
- Links: `#/name` opens on a disk and `#/name/readme` opens its README. The address follows the disk you are on.
- On phones, the box takes sideways swipes and the page scrolls vertically.

## Review

These need Playwright reachable through `NODE_PATH` or `node_modules`.

- `node scripts/review.mjs` serves `dist/` and captures representative states. External reads are fetched through `curl` so that READMEs load in containers with an HTTP proxy.
- `node scripts/contact-sheet.mjs` composes the frames into `recipe/evidence/contact-sheet.jpg`.
- `node scripts/measure-layout.mjs <out.json>` records the settled view's chrome boxes for `infer_alignment_axes.py`.
- `node --experimental-strip-types scripts/simulate-gates.ts` runs the stage's own springs and gates through interruption scenarios and checks clearance, exclusivity and order in the box.

Query parameters for review and weak devices:

| Parameter | Effect |
|---|---|
| `?stress=60` | Synthetic catalogue |
| `?renderer=flat` | No-WebGL fallback |
| `?quality=low` | Low quality tier |
| `?review=1` | Exposes `window.__rack.snap()`, plus `freeze()` and `step(ms)`, a fixed-step clock for sampling motion, and `flip()`; skips the boot screen's minimum |
