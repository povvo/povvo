# Direction v3: black metal and Helvetica

**Request, after the baseline:**
- "I'd say something experimental on titles than standard something like helvetica for any body text"
- "why don't we go for a different style. like old Nokia"
- "Nah more like actual black metal not like that as that looks slightly cartoonist almost like a kids version"

**Reading:** the Nokia idea is dropped. The direction is black metal as it actually looks, which is raw, cold and hand-drawn, not metal-flavoured fonts. That is the drawn title, the "experimental" one. Everything readable is set in Helvetica. The earlier metal study (`studies/type-metal.png`) is what "cartoonish" refers to, so the record starts with why it failed.

## Why the first metal attempt read as a kids' version

It started from a display font (Pirata One, with Metal Mania and UnifrakturCook as candidates). The letters were fat and rounded, and the thorns were twigs ending in balls. It sat on a coloured page. Those are the marks of novelty metal lettering, not of a band logo. Real black metal logos (the Darkthrone, Immortal and Emperor school, and the underground "unreadable" ones) share a different set of traits:

1. **A pen, not a font.** Thin, even strokes, with stems a little heavier than hairlines, as a nib gives.
2. **Needles.** Every free stroke end runs out to a sharp point, and nothing ends in a dot.
3. **Thorns up, roots down.** Spikes grow from the peaks and roots from the feet, and branches leave at acute angles like briars.
4. **A symmetric silhouette.** The end letters tower, wings and sweeps mirror about the centre, and often there is a centre spike. The letters themselves are not symmetric.
5. **Ink and toner.** White on black, ragged edges, ink pooling in tight joins, and the finest hairs breaking up, as in a photocopy.
6. **Half-legible.** The name is there if you look.

## The logo generator (`src/logo.ts`)

No font is involved. Each step below maps to a trait above.

- **Alphabet.** A hand-built narrow, angular alphabet (A to Z, 0 to 9, hyphen). Bowls are lozenges with pointed heads and feet, as in a gothic hand (trait 1).
- **Layout.** Letters scale up toward the ends of the word (`endBoost`), sit on a slight arch, and touch. Each is turned a hair, and every stroke wobbles along a slow noise field (traits 1 and 4).
- **Needles.** Free stroke ends grow tapered needles; vertical ones run long (trait 2).
- **Crowns, roots and barbs.** Crowns grow from top corners and roots from bottom corners, leaning outward from the centre with acute branches. Barbs sit along the long strokes, raked toward the nearer end (trait 3).
- **The frame, mirrored.** Wings leave the end letters. One to three spike columns sit at matching distances either side of the middle, each rooted in the nearest stroke on its own side. There are sweeps under (and sometimes over) the word, and a centre spike whose branches come in mirrored pairs (trait 4).
- **Ink pass.** A light blur, then two octaves of noise, then a threshold (trait 5).
- **Weight floor.** A minimum drawn weight in pixels, so the 52 px logos in the index hold together.

Every logo is a deterministic function of the name, so the same project always grows the same logo. Long names break into two or three balanced lines. The study is `studies/logo-sheet.html` and `studies/logo-sheet.png`.

**Iterations on the sheet**
1. The first pass read as frost, not menace: short hairy spikes, plain sans letters and no visible frame.
2. The second pass added the mirrored spike columns, longer wings, taller and narrower letters, a thinner pen and acute branches. The letters then went frail.
3. The third pass, the kept one, added heavier stems (the nib), pointed bowls, the pixel weight floor and fewer second-level twigs.

## The page

**Colour.** Night: white on black, plus the photocopied sheet for reading.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--page` / `--ink` | `#000` / `#fff` | Page and text | 21:1 |
| `--grey` | `#8c8c8c` | Secondary text on black | 6.25:1 |
| `--rule` | `#333` | Hairlines on black | Not text |
| Field border | `#636363` | Search field on black | 3.5:1 (UI boundary) |
| `--paper` / `--paper-ink` | `#fff` / `#000` | The open sheet | 21:1 |
| `--paper-grey` | `#666` | Labels on the sheet | 5.74:1 |
| `--paper-wash` | `#f0f0f0` | Inline code on the sheet | Black on it 18.4:1 |

**Type.** Helvetica for everything readable, through the stack `"Helvetica Neue", Helvetica, "Nimbus Sans", FreeSans, Arial`. That gives real Helvetica on Apple devices, Nimbus Sans or FreeSans (Helvetica's open clones) on Linux, and Arial on Windows. No webfont is shipped.
- Weights 400 and 700.
- Sizes 13, 15, 20 and 28 px.
- Bold names tracked in slightly (-0.01em).

The drawn logo is the only title; the readable name always sits in Helvetica beside or beneath it.

**Composition (wide).** It is laid out like a cover:
- the logo across the top of the stage, centred, up to 70% of the width and 32% of the height;
- the presented case standing just under it, centred at 57% with 40% of the stage height, overlapping the logo's foot;
- the rack a dark band below the middle;
- the caption at the foot on columns 1 to 4 (position, the name in bold, the description, the facts, Open);
- the neighbours at the foot on columns 10 to 12.

**Composition (phone).** The bar, then the logo, case and rack in the field. The caption and neighbours sit under the field.

**Cases** (`src/stage.ts`).
- Black glossy plastic (clearcoat over the print) under a cold key light from high in front, with a rim light from high behind. Without the rim, black cases vanish against the black page.
- Almost no fill light; black fog; rack cases toned to 62%.
- A black floor can't show a shadow, so a faint pool of light sits under the case in the air.
- The inside sheet is matte paper.

**Covers** (`src/covers.ts`, `src/xerox.ts`), as a demo tape would have them:
- **Front:** a photocopied night photograph, either a pine treeline in fog, bare branches against a grey winter sky, ridgelines, or a moon over trees. Each scene is painted in greys, then given a crushed tone curve, heavy grain, a partial threshold and the odd toner streak. The logo sits in white across the top, with the facts in small Helvetica at the foot. One case in five is the logo alone on black.
- **Spine:** black, with the logo running down it and the language code at the foot.
- **Inside left:** a white photocopied sheet with the logo in black, the name in Helvetica Bold and the description.
- **Inside right:** a black tray and disc, with the logo printed on the disc.

The study was `studies/cover-sheet.html` (with `?inside`) and `studies/cover-sheet.jpg`. Both now show the v4 disks and labels (`direction-v4.md`).

**Index.** A tape trader's list: number, logo, name in Helvetica, language and year. Logos are drawn as their rows scroll into view. The current row is printed in negative.

**Open.** The case's insert, as a white photocopied sheet sliding in from the right with toner dust over it. The black logo heads it, then the name in Helvetica Bold, the facts, the description and the README as plain Helvetica reading text. Code blocks are black, like the page.

## Motion

- The case mechanics, gates and reflow are unchanged (gate simulation: PASS).
- When the rack settles, the logo opens from its centre line outward over 640 ms, following its own symmetry. When the rack moves it fades in 120 ms.
- The caption fades; the sheet slides in 220 ms; the index fades in 160 ms.
- **The flicker** (`src/ui/flicker.ts`): every 15 to 40 s the whole page inverts for two flashes inside 170 ms. That keeps it within WCAG 2.3.1 (no more than three flashes in any second). Measured with a fake clock over 60 s: two bursts, at most two flashes in any second, 27 s between bursts. No burst comes in the first 8 s; that is set in the code, not measured.
- The flicker never runs under reduced motion, while a case is open, while the index is open, or in a hidden tab, and the Motion control in the bar turns it off. It carries no information, so nothing is lost without it (`evidence/reduced-motion-map-v3.result.json`, PASS).

## Review

The frames are in `evidence/review/` and `evidence/contact-sheet.jpg`. They were captured in headless Chromium with SwiftShader, which is not a representative GPU.

| Condition | Observation | Action |
|---|---|---|
| Settled, wide | Reads as a cover: the logo, then the case in the light, then the Helvetica caption. The rack is a dark band | Kept after one fix (1) |
| Sixty cases | Long logos run wide and dramatic; the case overlaps their foot | Kept |
| Turning | The logo and the caption go; only the rack moves | Kept |
| Index | A list of logos with Helvetica names | Kept after one fix (2) |
| Open | The sheet carries the black logo, the facts and the README; the case shows the paper insert and the disc | Kept |
| Phone | The logo heads the field; the case and rack sit under it; the caption follows | Kept |
| Reduced motion | Instant states, no flicker | Kept |
| No WebGL | The flat shelf sat over the logo | Fixed (3) |

**Defects found and repaired**
1. The rack at 50% tone was lost in the dark. It is now at 62%.
2. The Index logos were small in a wide column, and the current row's white ground ran flush with its number. The logos are now 52 px in three columns, and the rows' ground runs 10 px past the text.
3. The flat shelf kept the old composition's padding and covered the logo. It is now placed below the logo zone.
4. The search field's border measured 2.82:1 on black. It is now `#636363`, at 3.5:1.

**Checks**
- Type check and build are clean. The CSS is 13 kB and the app JS 63 kB; no webfonts.
- The review ran 47 frames. The only console errors were the expected ones: four 403s from the rate-limited GitHub API (the snapshot is used) and 404s for the synthetic catalogue's READMEs.
- The gate simulation passed all four invariants.
- The reduced-motion map passed.
- The flicker measurement is as above.

**Not run:** real-GPU playback, real phones, assistive-technology sessions, and a photosensitivity review by a person.
