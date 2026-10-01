# Visual system record (v2, Heat Sheet)

This record replaces the v1 visual system. The direction it implements is `direction-v2.md`.

Skills that own each part:
- `ui-typography`: typeface selection and voice; typography as form.
- `ui-color`: semantic roles; contrast and redundant encoding.
- `ui-visual-language`: shape grammar; edge language; surface and depth.
- `ui-layout-composition`: grid and spatial grammar; responsive composition.
- `look-development-for-motion` and `visual-development-for-motion`.

Evidence:
- `studies/type-specimen-v2.png`, rendered with the installed Fontsource files. Big Shoulders, Sofia Sans Extra Condensed, Instrument Serif and Newsreader were removed from the build after the specimen, so the HTML now renders only the kept families. The PNG is the record of the comparison.
- `studies/cover-sheet.html`, which draws every cover from the snapshot through `src/covers.ts`. Serve it with `pnpm dev` at `/recipe/studies/cover-sheet.html`, and add `?inside` to see the inside faces.
- The contrast figures in `direction-v2.md`, measured with the WCAG 2.x formula.

## Typography

There are four families, each with one job. No family is used outside its job.

| Role | Family and axes | Setting | Job |
|---|---|---|---|
| Giant title (stage) | Anybody italic, wdth 50, wght 900 | Fitted to the stage width, one to three lines, line height 0.84, cap 34% of stage height | The object word behind the object |
| Cover, spine and disc titles | the same face as **Heat Display** (axes fixed in `@font-face`) | Fitted per layout by `fitDisplay` | Printed matter |
| Spread title, README h1 and h2, the cockpit heading | Anybody italic | 46 to 132 px | Short object words only |
| Wordmark | Bodoni Moda italic, opsz 64 | 34 to 56 px | Identity; the only serif display |
| Standfirst (caption, spread, inside sheet) | Bodoni Moda italic, opsz 20 to 32 | 18 to 30 px, line height 1.18 to 1.24 | The voice: what the project is |
| Apparatus (capsule codes, protocol strip, positions, buttons, tracklist columns, callout) | Martian Mono, wdth 112.5 (squared) or 75 (provenance) | 9 to 12 px, uppercase, tracking 0.03 to 0.05em | Codes, facts, provenance |
| Reading (README body), tracklist names | Archivo, wdth 88 to 100 | 13 to 16 px, line height 1.65 for reading | Sober functional text |

Specimen observations:
- Anybody at width 50 is compressed and slashed. It carries the mixtape and streetwear energy that Archivo at 62 lacks; Archivo condensed read as generic.
- Bodoni Moda at opsz 96 loses its hairlines at 72 px on a standard-density screen, so the wordmark uses opsz 64.
- Martian Mono gives grandtao's squared protocol voice and editorialisated's condensed provenance voice from one family.
- Archivo stays for reading because READMEs are technical: lists, tables and code need a sober grotesk.

Rejected:
- Plex Mono (Spec-Scan carry-over).
- Fraunces (the v1 library voice).
- Any second display family.

## Colour

The page is paper and the objects are hot. Every pair below was measured; tokens are in `src/styles.css :root` and `src/catalogue.ts`.

| Role | Value | Use and pair |
|---|---|---|
| Heat field | sky `#CFE6DF` to off-white `#F8F1DF` at the horizon, sand `#EFE3C1` to dust `#D8BE83` below | The stage background. The horizon is the 3D floor's vanishing line (`--horizon`, set by the stage). |
| Ink | `#111719` | Text and rules on paper (14.2 on sand) |
| Ink muted | `#4A5355` | Secondary text (6.2 on sand, 7.0 on off-white) |
| Cockpit | petrol `#092E35`, line `#1D4A52`, text `#F8F1DF` (12.8), muted `#8FB9B6` (6.7) | The tracklist panel |
| Cockpit marker | lime `#DDEB28` | Current row and focus ring in the cockpit (11.0 on petrol) |
| Shells | sixteen collision colours from the patchwork palette (direction-v2 tokens) | Cases, cover title blocks, spines, and the spread's title block. Text colour per shell is the measured better of ink and paper (`textOn`), all at or above 4.5. |
| Patchwork | nineteen tile colours (`src/tiles.ts`) | Quilts, the tile cube, the curtain and the chrome rails. Each quilt draws five to eight colours anchored on its shell. Never behind reading text. |
| Bone | `#F4EFE1` | Specimen covers, the inside sheet, the spread paper |
| Intervention | signal red `#E7202E` | Hover on the two primary actions, and the specimen event dot. Nothing else. |

Rules:
- The current case is marked by position (out of the rack), by a tracklist row with a lime number block and bar, and by a rail marker with its number. It is never marked by colour alone.
- Reading text never sits on a shell colour.

## Shape, edge and surface

- **Panels** are square-cornered, with a 1 px ink rule. The caption is a specimen label: paper, rule, and a 4 px offset print shadow.
- **Capsules** (999 px radius) are used only for codes.
- **Edge rails**:
  - tile strips on the protocol strip and the cockpit foot;
  - the numbered tick rail on the stage;
  - the tile rail along the foot of horizon covers.

  All are cropped at the edges, so they read as found rather than ornamental.
- **The patchwork** (`src/tiles.ts`): flat, hard-edged tiles with no strokes, gradients or rounded corners.
  - Eight kinds: solid, checker, stripes, arc, split, diamond, bar and numeral.
  - Diamonds cross the grid at its intersections.
  - It is the collision: covers, spine heads, the disc label, the spread slab, the arrival curtain and the chrome rails.
- **Grain**: a static SVG noise tile at 9% multiply over the field, the giant title and the 3D objects. It is never applied to the chrome text or the spread.
- **Halftone** stays contained, inside the specimen cover's sphere.

## Cover system

The cover system is in `src/covers.ts`. Every cover is a deterministic function of the entry. The eleven-layout cycle and the ten-shell cycle are coprime, so pairings keep varying across sixty cases.

| Layout | Relationship | Motifs |
|---|---|---|
| quilt | Collision: a 3 by 3 patchwork with a diamond across it and the volume numeral, over a bounded title block in the shell | The patchwork itself |
| block | Packaging collage: an accent band with the capsule code and volume, a drawn heat-field "photograph", a checker block and a numeral block, the title on the shell | Checker block |
| horizon | Drift: a pale heat field, a horizon, one tiny hot object with a long heat shadow | Numeral edge rail; tile rail along the foot |
| specimen | Order: bone and ink, a contained halftone sphere, one red event dot with a drawn callout | Hairline frame |

Other faces of the case:
- **Spine**: a tile head, the title in Heat Display, a small accent square, and the capsule code.
- **Inside sheet**: the liner notes (title, Bodoni standfirst, pointer to the booklet).
- **Disc**: black vinyl with grooves and a band of sun sheen. Its label is an isometric cube faced with the case's patchwork.
- **Volume numeral**: the accession number, the order in which the work was started. It is printed only on covers, the disc and the callout ("Vol. 07").

## Layout

**Wide (1024 px and up)**
- The stage takes the remaining width and the cockpit takes `clamp(330px, 28vw, 430px)`.
- On the stage:
  - masthead top left;
  - protocol strip top right;
  - tick rail on the right edge;
  - specimen label bottom left;
  - colophon along the foot;
  - the giant title centred on the presentation spot (`--hero-y`, set by the stage).
- The spread covers the right `min(760px, 54vw)`. The label and rail step out while it is open.
- The spread's slab:
  - the case's patchwork, revealed in six hard steps;
  - the capsule code, position and Close on solid shell blocks;
  - the title on a solid shell block that clones across line breaks.

**Narrow**
- The stage field is `max(540px, 72svh)` tall. The label and colophon flow beneath it, and the cockpit follows as a full-width band.
- The canvas takes horizontal swipes and leaves vertical scroll to the page (`touch-action: pan-y`). Vertical wheel and arrow keys scroll the page.
- The callout is hidden below 700 px, where its label would leave the stage.

## Look development

- **Look thesis**: glossy automotive shells in hard sun on a heat field.
- **Materials**:
  - shells: `MeshPhysicalMaterial`, roughness 0.55, clearcoat 1, clearcoat roughness 0.16;
  - edges: clearcoat 0.8;
  - inside sheet: roughness 0.85, clearcoat 0.2.
- **Environment**: a generated dome, sky to off-white haze to dust, with a low sun disc, prefiltered with PMREM. The gloss therefore reflects the same field the page is printed on.
- **Light**:
  - one warm key from high front left with 2048 px PCF shadows on a shadow-only floor;
  - a sky-to-sand hemisphere fill.
- **Tone mapping**: Khronos Neutral, because ACES moved orange toward yellow and broke the measured shells.
- **Fog**: off-white haze, so the far side of the arc fades into the field.
- **Not run**: wedges on a real GPU (see `review.md`).
