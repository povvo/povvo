# Critique of v2 and the composition pass (v2.1)

Following the critique note protocol in `ui-art-direction/references/critique-diagnosis-and-validation.md`, and `motion-art-direction` hierarchy, exclusion and restraint.

**Scope and review mode.** A structural review of the settled, turning and open states at 1440 by 900 and 390 by 844 (`evidence/contact-sheet.jpg` at v2).

**Intent.** Visitors should feel both the size of the body of work and that each piece is singular. Read order: object, then title, then annotation, with the field quiet and the cockpit dense.

**What works and must be preserved**
- The rack and the gated case mechanics.
- The heat field and its horizon.
- The patchwork covers, the tile-cube vinyl and the quilt slab on the spread.
- The arrival cut.
- The open spread.
- Ethan liked the direction ("pretty good honestly").

**Observed symptom.** Ethan: "there's like messy and then there's sort of all over." Described before judging, the settled view at once shows:
- the masthead wordmark;
- a four-cell protocol strip with a tile fragment;
- a giant title hidden behind two objects (the rack and the case);
- the floating case;
- a boxed callout label over the rack;
- a tick rail with numerals;
- a bordered and shadowed caption card with a black button;
- a colophon row with a pill;
- a full-height dark cockpit with its own display heading, two controls, sixty rows and another tile fragment.

That is about ten independent visual systems, each with its own voice, and none clearly dominant.

**Why it matters.** Zawada's work is maximal but controlled: a collage has one governing frame, and its density is bounded. Here the density is spread evenly as apparatus, so the page reads as scattered rather than collaged. The giant title, meant as the second read, is occluded by both the rack and the case and reads as noise. The caption card and the permanent sidebar are application patterns, which pull the page toward a dashboard.

**Decision level.** Structural: hierarchy and composition. It is not finish. Per the reference, grain, glow or type polish must not be used to repair it.

**Measured.** The settled view's 24 text blocks and controls sit on 12 distinct left edges (`evidence/layout-before.json`, `infer_alignment_axes.py` at 3 px tolerance). There is no shared column structure.

## Composition rules for v2.1

1. **One grid.** Twelve columns with 32 px margins and 24 px gutters on wide screens; four columns with 16 px margins on phones. Every chrome block starts and ends on a column line.
2. **Three layers, one each.** The field (sky and sand), one object (the presented case, with the rack as its setting), one word (the title).
   - The title is anchored to the bottom of the stage, left-aligned on column 1, and set at a constant size from project to project. It shrinks only when a long name needs two lines.
   - The case floats above it and just overlaps its top edge.
   - Nothing else is large.
3. **Apparatus is typeset, not boxed.**
   - One header row: wordmark, line, index, motion, GitHub.
   - One caption column on the left: number and code, standfirst, meta, open.
   - One navigation column on the right: previous and next.
   - No cards, borders, shadows or pills on the stage.
4. **Removed from the default view**
   - The protocol strip.
   - The tick rail.
   - The callout.
   - The colophon row.
   - The chrome tile fragments.
   - The permanent cockpit.
5. **The index becomes a moment.**
   - A full-screen cockpit opens from the header (or with `I`).
   - The tracklist is set large in the display face.
   - A cover preview follows the pointer over each row.
   - Choosing a row turns the rack to it.
   - The density lives there, bounded, instead of beside the stage at all times.
6. **The patchwork appears big or not at all.** On the covers, the curtain, the spread slab and the index previews; never as sprinkles.
7. **Light leads the eye.** Rack cases are toned down and the presented case is at full brightness, so the saturated spines read as setting, not as a rainbow. A soft contact shadow under the floating case gives its height.
8. **Finish, only after structure.**
   - Masked line reveals for the caption and the title. The title reveal is a two-plate print: shell colour first, ink a beat later.
   - A cursor with a label (Drag, Open, View) for fine pointers at full motion.
   - Subtle pointer parallax on the camera.

**Acceptance evidence**
- The settled view shows at most five chrome groups on fewer than seven left edges.
- The title is fully legible except where the case overlaps its top edge.
- The contact sheet reads object, then word, then annotation.
- Phone and reduced motion keep the same information.

## Result (v2.1, at the commit that carries this file)

**Groups.** The settled view now holds four chrome groups (the bar, the caption, the neighbours, the title) around one object.

**Alignment.** Measured with `infer_alignment_axes.py` at 3 px tolerance:

| | Before (v2) | After (v2.1) |
|---|---|---|
| Blocks | 24 | 14 |
| Distinct left edges | 12 | 7 |
| Largest shared left axis | 5 blocks | 8 blocks (column one) |
| Unaligned blocks | 1 | 0 |

Every block now sits on an axis. The remaining left edges are column starts (1, 4 and 7) and the right-aligned navigation, whose right edges align. Evidence: `evidence/layout-before.json` and `evidence/layout-after.json`.

**Perceptual.** The frames read in order: case, then word, then the typeset columns. The title is fully legible: the rack stands above it on the horizon, and the case floats above it with its contact shadow between. The rack reads as setting at 70% tone. The patchwork appears big: on the covers, the curtain, the spread slab, and the index cover preview.
