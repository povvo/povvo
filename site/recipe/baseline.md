# Baseline: black and white

**Request:** "hm let's strip the actual visual language back to nothing imagine it's literally the most boring black and white simple thing then we can work on it"

**What this is:** a reset, not a direction. The site keeps its skeleton and behaviour, and loses everything that was a visual decision. From here, each piece of visual language is added back on purpose, one at a time, against a neutral page. Before this, v2 and v2.1 (`direction-v2.md`, `critique-v2.md`) piled several languages up at once, and the type and metal experiments (`studies/type-systems.png`, `studies/type-metal.png`) changed one layer of that pile without a stable ground.

## Kept: the skeleton

- **The rack.** Cases sit on a revolving arc, with the camera framed by on-screen proportion (rack about 21% of the stage tall, presented case about 42%).
- **The case mechanics.** Gated springs in `src/gates.ts` are unchanged: pull, then turn, then open; close, then turn back, then retract; one case turned at a time. The gate simulation still passes.
- **Reflow.** On filter or sort, cases sink through the floor, re-slot unseen and rise again.
- **The grid.** Twelve columns on wide screens and four on narrow ones. The bar is on a subgrid, the caption on columns 1 to 3, the neighbours on 10 to 12.
- **The index.** The full-screen list has search, four orders, a focus trap, the `I` key and Esc.
- **The spread.** The open case sits beside a panel with the facts, the description and the README.
- **Data and fallbacks.** The live catalogue, the snapshot, the README fetch and sanitising are all kept, as are the flat no-WebGL rack, reduced motion and the review hooks.

## Removed: the visual language

All of it is in `parked/` with a README, outside the build and the type check:
- the patchwork tile system and the four cover layouts;
- the tile cube, the vinyl disc and the spread's patchwork slab;
- the heat field background, sky-to-sand environment, sun key light and grain;
- the sixteen hot shells and their accents, and the capsule codes (`ELB-PY-26`);
- the giant title at the foot of the stage, with its two-plate print (`parked/ui/hero.ts`);
- the arrival curtain, the labelled cursor, the pointer parallax and the page flicker;
- every display, serif and mono webfont, and the five type systems;
- the black metal logo generator.

The font packages were removed from `package.json`. `recipe/studies/metal-sheet.html` now imports from `parked/` and needs its font reinstalled to render.

## The baseline system

**Colour.** Black, white and one grey. Contrast is the WCAG 2.x ratio, measured.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--ink` | `#000` | All primary text, rules that close a header | 21:1 on white |
| `--paper` | `#fff` | Page, cases, panels | — |
| `--grey` | `#767676` | Secondary text: positions, meta, labels | 4.54:1 on white |
| `--rule` | `#d9d9d9` | Hairlines | Not text |
| `--wash` | `#f2f2f2` | The selected index row, code blocks | Black on it 18.8:1. Grey on it is 4.06:1, so the selected row's small text is set in ink |

**Type.** There is one family, the system sans (`system-ui` and its fallbacks), at weight 400 throughout. The exceptions:
- README headings are 600, because they are the README's own structure;
- code and `kbd` use the system monospace.

There are four sizes:

| Token | Size | Use |
|---|---|---|
| `--small` | 13 px | Bar, positions, meta, index columns |
| `--body` | 15 px | Description, list names, README |
| `--title` | 20 px | Caption title, index heading |
| `--big` | 32 px | Spread title; 26 px on phones |

No uppercase, tracking or display face.

**Cases.**
- Material: white, nearly matte card (roughness 0.72, no clearcoat), with grey edges.
- Lighting: a neutral `RoomEnvironment` for reflections, and one white key from nearly overhead so that the floating case's shadow falls under it, not across the floor. Floor shadows are at 8% black, with a soft contact blob under the case in the air.
- Fog: far cases fade to white.
- Rack cases are toned to 70% so the presented case reads first.

**Covers** (`src/covers.ts`), drawn in black and grey on white:
- Insert: the title top left; "Ethan Lee Barrett" and language and year at the foot.
- Spine: the title, with the language code at the foot.
- Inside left: the title and description.
- Inside right: a pale tray and a plain grey disc with the name.
- The canvases are created with alpha. An opaque 2D canvas gets subpixel text with colour fringes, which a black-and-white page cannot have.

**Motion.** Nothing decorative:
- the caption fades in over 160 ms and out over 120 ms;
- the index fades in over 160 ms;
- the spread slides in from the right in 220 ms;
- the case mechanics are unchanged;
- reduced motion makes every one of these instant (`evidence/reduced-motion-map-baseline.result.json`, PASS).

**Composition.** With no title at the foot, the rack is centred at half height and the presented case a little above it (43% on wide screens). The caption now shows the project title visibly. Before, it was screen-reader only because the giant title carried it.

## Review

The frames are in `evidence/review/` and `evidence/contact-sheet.jpg`. They were captured in headless Chromium with SwiftShader, which is not a representative GPU.

| Condition | Observation | Action |
|---|---|---|
| Settled, wide | Bar, caption and neighbours sit on the grid in black and grey. The white case floats over a grey-toned rack | Kept after two fixes (1, 2) |
| Turning | The caption fades and keeps its space, so nothing jumps | Kept |
| Index | A plain ruled list; the current row is on the wash | Kept after one fix (4) |
| Open | The case opens beside a white panel; the README is plain reading text | Kept after one fix (3) |
| Sixty cases, filter, reflow, close-on-turn | Mechanics behave as in v2.1 | Kept |
| Phone | The bar holds the name, Index and GitHub. The field comes first, then the caption and neighbours. The spread is full screen | Kept |
| Reduced motion, no WebGL | Instant states, and a flat rack of white spines and a white insert | Kept |

**Defects found and repaired**
1. The key light was low and to the side, so the floating case threw a hard grey parallelogram across the floor. The key moved nearly overhead and the floor shadow went from 12% to 8%.
2. The GitHub link sat higher than the bar's buttons. The nav now aligns on the baseline.
3. Canvas text had colour fringes from subpixel antialiasing. The canvases now have alpha.
4. Grey text on the selected row's wash measured 4.06:1, and the disc's facts line on the grey disc 3.31:1. Both are now ink.

**Checks**
- Type check and build are clean. The build ships no webfonts: the CSS is 11 kB and the app JS 42 kB.
- The review ran 47 frames. The only console errors were expected ones: four 403s from the GitHub API (this container is rate-limited, so the snapshot is used) and 404s for the synthetic catalogue's READMEs.
- The gate simulation passed all four invariants (clearance, exclusivity, order, front).
- The reduced-motion map passed.

**Not run:** real-GPU playback, real phones, and assistive-technology sessions.

## Building back up

Bring one layer back at a time and review it against this page before adding the next. Possible layers:
- a typeface for one role;
- one colour, and what it is allowed to mean;
- a cover system;
- a surface for the cases;
- the page's ground;
- one signature motion.

The parked pieces can be reused, but each one returns as a decision with a reason, not as a default.
