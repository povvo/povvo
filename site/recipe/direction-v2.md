# Direction v2: Heat Sheet

Status: directional, drafted in this build. Ethan Lee Barrett makes the final call after reviewing the built site. This record replaces the colour, type, surface and composition sections of `direction.md`. The mechanism (a revolving rack, one case out, open to read) is kept because the review praised the skeleton.

## Why v2

The first build read as a library: warm stock, a book serif, muted inks, a quiet split page. The cases were well made, but the page around them had no point of view. The brief asks for something editorial and crafted. Ethan pointed at Jonathan Zawada's visuals for *Hi This Is Flume* and four of his own pastiche extractions (`hi`, `hi-this-is-not-flume`, `grandtao-datawear`, `editorialisated`, `greedy`). He said that using all five as they are would clash, and that the result should take the best of each and fold it into one language.

The review also found real faults in the mechanism:
- Cases intersect while they turn.
- Moving off an open case snaps it shut.
- Reflowing the rack after a filter makes cases slide through each other.

These are fixed in the same pass (see "Mechanism changes").

Midway through the build Ethan sent five images of the actual Zawada work:
- a frame from the visual mixtape: a flat geometric patchwork;
- the packaging: a car photograph against a checker block and a numeral block;
- the gatefold: a collage of photographs, tile panels and landscapes;
- the vinyl label: a patterned isometric cube;
- the sleeve with the record.

They showed what the text extractions had under-described: **the patchwork**. It became the master motif, recorded in its own section below.

## Thesis

Because the visitor meets sixty projects by one person and needs to feel both the size of the body of work and the singularity of each piece, the catalogue is set as a campaign sheet printed under heat. A pale sun-bleached field holds the rack like a horizon. One hot, glossy object, the current case, stands in front of its own enormous condensed title. A dense dark cockpit holds the full tracklist. Around the object, the archive's apparatus (protocol codes, provenance lines, a drawn callout, an edge rail) annotates it in small type.

Read order: object, then title, then annotation. Quiet register: the field. Dense register: the cockpit.

## Mechanism-first map

| Source | Mechanism kept | Intended effect | Context difference | Anti-copy note | Disposition |
|---|---|---|---|---|---|
| hi-this-is-not-flume (Zawada) | Pale heat field interrupted by one bounded high-chroma collision; two-register density (empty drift versus packed cockpit); a tiny marker activating a large field; edge rails of numbers and checks; slanted display only on short strings | Heat, distance, then impact | A finder, not a record campaign: the collision is the selected project, not a scene | No Flume wordmark, no car, no photographs, no specific crops or badges | **Master grammar** |
| Hi This Is Flume artwork (images Ethan supplied) | Flat hard-edged geometric patchwork: checkers, stripes, 45° diamonds laid across the grid, arcs, splits and a big numeral, in unexpected saturated pairs (violet with aqua, magenta with sage, tan with indigo); photographs collaged against flat graphic blocks; a patterned isometric solid as a label | Collision as construction: the work looks assembled from parts, playful and engineered at once | A finder: the patchwork is generated per project from its name, not drawn once; the "photograph" is a drawn heat-field scene | No Flume wordmark; no use of the "1" as a mark (our numerals are data: the volume, which is the accession order); no car or other photographs; no reproduction of a specific frame, sleeve or label composition. The cube is built from our tiles | **Master motif** |
| hi (Collision Heatfield) | Field 60–85%, collision 10–30%, marker under 5%; "cut, hold, drift" timing; compressed slashed italic display | Proportion discipline, so the colour stays a hit and not a wash | Same source; its proportions are used as a budget | Same exclusions | Kept as the **proportion and timing budget** |
| greedy | Huge condensed title set behind the subject; dense 12–14 px utility captions; callout circles with leader lines; one rare red intervention; static grain | The object reads as hero; the small print reads as engineered | Streetwear campaign versus code catalogue; the "subject" is a 3D case, not a model | No photography, no logos, no garment marks | Kept: **type-behind-object, captions, callout, grain** |
| grandtao-datawear | High-contrast italic serif wordmark; squared extended technical labels; capsule codes; hairline rules; contained halftone; 4:1 order to corruption | Authority, fashion-grade restraint, a system of codes | A person's name, not a brand; codes are derived from data, not invented SKUs | **No orbital eye mark**, no grandtao names | Kept: **wordmark voice, capsule codes, halftone cover** |
| editorialisated | Archive dossier: serial labels, provenance mono, circular annotations, specimen grids, stamp entry and register-fast cuts | The catalogue feels collected and proven | Positional numbering, not invented catalogue numbers | No borrowed archive imagery or event names | Kept: **provenance lines, stamp timing, specimen discipline** |

The test: replace every source with its row and the route still makes sense. It does, because each row names a relationship rather than a look.

## Contradictions resolved

| Tension | Sources pulling apart | Resolution |
|---|---|---|
| Colour | Zawada and hi are high-chroma. grandtao is monochrome. editorialisated is warm paper or crushed black. greedy is paper with one red. | **The page is paper; the objects are hot.** The field is the heat gradient (sky, off-white, sand). Collision colour lives only in the cases, the cover art and one bounded slab per view in the current case's colour. Greedy's "one red" becomes the open action. grandtao's monochrome survives as one of the four cover layouts. |
| Type | Every source has a display face. | One family per job, four jobs: **Anybody** (condensed italic heavy) for object words only: titles, spines, covers. **Bodoni Moda italic** for the voice: wordmark and standfirsts. **Martian Mono** for apparatus: codes, captions, provenance, the tracklist. **Archivo** for reading: README body and controls. Nothing else. |
| Texture | editorialisated photocopy damage, greedy grain, grandtao halftone, Zawada gloss | **Grain is global and static** at 4% over the field only (never on text panels). **Halftone is contained** inside one cover layout and the open spread's header slab. **Gloss is physical**: the case clearcoat. No photocopy damage on text. |
| Motion | Zawada drift; hi cut and hold; grandtao still; editorialisated stamp; greedy print shift | **Drift for the object, cuts for the type.** The rack turns on a critically damped spring. Titles cut out the moment the rack moves and stamp in on settle with a two-frame registration offset. Captions scan in. Markers snap. Nothing loops and nothing idles. |
| Density | Zawada sparse field versus cockpit; grandtao catalogue grid; greedy dense captions | **Two registers, never blended.** The stage is sparse: one object, one title, a few annotations. The cockpit (index) is dense: sixty rows of mono in a dark petrol panel. |
| Numbering | editorialisated serials versus the v1 accession numbers | **Positional numbers** (`04 / 11`) in the stage and tracklist. **Capsule codes** (`ELB-PY-26`) derived from language and year. Accession order stays as a sort. |

## The patchwork

`src/tiles.ts` holds the tile system:
- eight tile kinds: solid, checker, stripes, arc, split, diamond, bar and numeral;
- a quilt composer, in which no tile repeats the colour of its left or upper neighbour, and diamonds cross grid intersections;
- an isometric tile cube;
- a strip generator.

Seeds come from the repository name, so a project's patchwork is stable.

Where it appears (the collision budget):
- covers, in two of the four layouts:
  - **quilt**: patchwork over a bounded title block;
  - **block**: the packaging collage, with a drawn heat-field "photograph", a checker block and a volume numeral;
- spine heads;
- the disc label (the tile cube on black vinyl);
- the open spread's slab;
- the arrival curtain;
- two small tile rails in the chrome.

It never sits behind reading text. Words on the slab sit on solid blocks of the shell colour, hard against the patchwork.

**The arrival cut** is the opening beat, once per session:
1. A full-bleed patchwork holds the screen as a title card, with the number of projects as its numeral.
2. It is cut away in scattered hard cuts, about 40 ms apart, to reveal the heat field.
3. Collision, then drift.

It is skipped under reduced motion. A tap or a key ends it at once, and it never holds the page longer than 1.6 s.

## Composition

> **Superseded by the composition pass.** After Ethan's review ("there's like messy and then there's sort of all over"), the layout below was replaced by the rules in [`critique-v2.md`](critique-v2.md):
> - one twelve-column grid;
> - three layers, one each;
> - the title anchored to the foot;
> - the apparatus typeset, not boxed;
> - the tracklist as a full-screen index;
> - the callout, tick rail and protocol strip removed.
>
> The record below is the v2 layout, kept for history.

**Wide (≥1024 px)**
- **Stage, the left 70%.**
  - Heat field and grain.
  - The giant title, set in the DOM behind the transparent WebGL canvas and fitted to the stage width.
  - The rack stands on an implied horizon with a real contact shadow. The current case floats out in front of the title.
  - Masthead top-left: Bodoni wordmark and a mono line.
  - Protocol strip top-right.
  - Caption block bottom-left: capsule code, position, standfirst, meta, and the open action.
  - Live callout: a drawn circle and leader line tracking the case's spine code.
  - Edge rail on the right edge of the stage: numbered ticks, current tick marked.
- **Cockpit, the right 30%.** A petrol panel holding the tracklist: number, name, code and year rows; find; order. The current row carries the lime marker.
- **Open state.** A paper spread slides over the cockpit (min(760 px, 54vw)). It has:
  - A header slab in the case colour with the Anybody title.
  - A protocol row.
  - A Bodoni standfirst.
  - The README in Archivo, with mono code.
  - The case swings open on the stage beside it.

**Narrow (<1024 px)**
- Masthead.
- Stage (60svh) with the title behind the case.
- Caption under the stage.
- The cockpit as a dark band below, holding the full tracklist.
- The open spread is full screen.
- The stage takes horizontal drags and leaves vertical scroll to the page (`touch-action: pan-y`).

## Signature patterns

1. **Type behind the object.**
   - The current title sits behind the extracted case, fitted to width, in ink.
   - Recurrence: one title, always the current case's.
   - Variation: one or two lines depending on length.
   - Failure: the title over the case, a second giant word, or giant type in the cockpit.
2. **The registration stamp** (v2.1: now a two-plate print, with the colour plate rising first and the ink landing on it, then the colour plate lifting away).
   - On settle, the title appears with a misregistered copy in the case colour offset by a few pixels for two frames, then registers.
   - Recurrence: once per settle.
   - Under reduced motion it is a plain swap.
   - Failure: looping glitch, chromatic aberration on body text, or the effect on every hover.
3. **The callout** (removed in v2.1; the cover carries its own code).
   - A hairline circle drawn around the spine code of the case that is out, with a leader to a mono label.
   - Recurrence: only on the current case, only when settled.
   - Failure: callouts on several objects, or decorative circles with nothing inside.

## Anti-targets

- **Festival neon**
  - Failure signature: gradients of every collision colour across the page, glowing type, dark page with neon.
  - Countermeasure: colour budget, with collision under 30% of any view.
- **Library calm** (v1)
  - Failure signature: warm stock, book serif titles, muted inks, nothing large.
  - Countermeasure: the giant title and the hot cases are mandatory in every settled view.
- **Source cosplay**
  - Failure signature: anything recognisable as Flume, grandtao or greedy property (marks, cars, photographs, the orbital eye, garment codes).
  - Countermeasure: the exclusion list below.
- **Glitch theatre**
  - Failure signature: registration offsets, scanlines or noise on reading text, or effects that loop while nobody is touching anything.
  - Countermeasure: effects are on display type only, once per settle.
- **Spec-Scan carry-over**
  - Failure signature: cyan instrument lines, IBM Plex Mono, scanlines, the aperture P.
  - Countermeasure: Martian Mono and paper rules instead.

## Exclusions

Do not reproduce any of these:
- the Flume wordmark or Zawada's imagery, cars, figures or crops;
- grandtao's orbital eye mark or product names;
- greedy's logos or photographs;
- editorialisated's archive imagery.

The sources are evidence of mechanisms only, and their rights are unverified.

## Tokens

- **Field**
  - sky `#CFE6DF`, off-white `#F8F1DF`, sand `#EFE3C1`, dust `#D8BE83`.
  - ink `#111719`, ink-muted `#4A5355` (6.2 on sand).
- **Cockpit**
  - petrol `#092E35`, line `#1D4A52`, text `#F8F1DF` (12.8), muted `#8FB9B6` (6.7), marker lime `#DDEB28` (11.0).
- **Shells** (case colours; sixteen, from the patchwork palette), with the text colour measured for each (paper is `#F8F1DF`):

  | Shell | Hex | Text | Contrast |
  |---|---|---|---|
  | teal | `#008C9A` | ink | 4.50 |
  | orange | `#FF4B1F` | ink | 5.41 |
  | violet | `#5200DC` | paper | 7.79 |
  | acid | `#EFE61B` | ink | 13.8 |
  | indigo | `#0B1BA2` | paper | 11.0 |
  | pink | `#F59AC7` | ink | 8.90 |
  | forest | `#2E5B2D` | paper | 7.03 |
  | aqua | `#2EFFE3` | ink | 14.2 |
  | magenta | `#AE3571` | paper | 5.25 |
  | lime | `#DDEB28` | ink | 13.8 |
  | petrol | `#092E35` | paper | 12.8 |
  | red | `#DA0028` | paper | 4.65 |
  | sage | `#9EAA75` | ink | 7.29 |
  | brown | `#8A4C0A` | paper | 5.98 |
  | sky | `#14C9F8` | ink | 9.26 |
  | oxblood | `#5D0E1A` | paper | 12.1 |
  | bone (specimen only) | `#F4EFE1` | ink | 15.8 |

- **Patchwork palette** (`TILE_COLOURS`): violet `#5200DC`, aqua `#2EFFE3`, sky `#14C9F8`, magenta `#AE3571`, sage `#9EAA75`, oxblood `#5D0E1A`, olive `#A6B414`, tan `#BAA07F`, brown `#8A4C0A`, indigo `#0B1BA2`, periwinkle `#5452F2`, green `#7ED431`, mint `#35C988`, red `#DA0028`, acid `#EFE61B`, pink `#F59AC7`, forest `#2E5B2D`, orange `#FF4B1F`, teal `#008C9A`.
  - Each quilt draws a sub-palette of five to eight colours anchored on the case's shell.
  - The shells grew to sixteen from this palette. Every shell's text colour is the measured better of ink and paper, at 4.5 or above.
- **Intervention**: signal red `#E7202E`, used only for the open action's hover and the error state.
- **Focus**: a 2 px ink ring on paper; a 2 px lime ring in the cockpit.
- **Radius**: 0 on panels; 999 px on capsule codes only.
- **Rules**: 1 px hairlines in ink at 22% on paper, `#1D4A52` in the cockpit.
- **Motion**
  - Enter `cubic-bezier(.18,.72,.18,1)`, exit `cubic-bezier(.4,0,1,1)`, in place `cubic-bezier(.28,.9,.22,1)`.
  - Marker snap 100 ms, label 140 ms, caption scan 220 ms, callout draw 300 ms, spread 420 ms.
  - Rack and case springs as listed in `contracts/`.

## Mechanism changes

- **Per-case gated springs.**
  - Each case owns pull, turn and open.
  - Out: pull clears the rack first, then turn, then open. Back: close, turn back while still clear, then retract.
  - Only one case may be turned at once.
  - A case that loses the selection runs its own reverse sequence while the rack turns, so nothing snaps.
- **Reflow by lift.**
  - When filtering or sorting moves a case to another slot, it sinks below the floor (clipped), jumps to its new slot unseen, and rises again in a short stagger.
  - Cases never slide through each other.
- **Floor.** A shadow-only ground plane anchors the rack on the heat field.
- **Data.** The live read paginates past 100 repositories.
