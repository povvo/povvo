# Skill application

The catalogue is one production that used the Motion Design Skills and the Good Fuckin Frontend skills by the decision being made, not by loading all of them. This map records which workflow references were actually read, which helpers were actually run on this project's inputs, and where each skill's contribution lives in the source. Helpers were run on authored contracts in `contracts/`; their results are in `evidence/`. A helper `PASS` is a mechanical fact about its contract and not an aesthetic verdict.


## v2.1: the composition pass

The composition pass responds to Ethan's review of v2: "there's like messy and then there's sort of all over".

**UI art direction** (`critique-diagnosis-and-validation.md`) and **motion art direction** (`hierarchy-exclusion-and-restraint.md`).
- Wrote a critique note to protocol in `critique-v2.md`:
  - **Classification.** The failure is structural (hierarchy and composition), not finish. Polish was therefore not used to repair it.
  - **Diagnosis.** About ten independent systems shared the settled view.
- Set eight composition rules: one grid; three layers, one each; apparatus typeset, not boxed; removals; the index as a moment; the patchwork big or not at all; light leads the eye; finish only after structure.

**UI layout and composition.**
- `infer_alignment_axes.py` was run on chrome boxes measured from the built page (`scripts/measure-layout.mjs`), before and after:
  - distinct left edges went from 12 to 7;
  - the largest shared left axis went from 5 blocks to 8;
  - unaligned blocks went from 1 to 0.
- The page is now one twelve-column grid (`subgrid` for the bar), and the stage camera is framed by on-screen position targets so the rack never covers the title.

**Look development** and **3D motion design**.
- A lighting hierarchy: rack cases at 70% tone, the presented case at full brightness (`setTone`).
- A soft contact shadow under the case in the air, scaled and faded with its height.
- Pointer parallax on the camera, on fine pointers at full motion only.

**Kinetic typography.**
- The title is a two-plate print through line masks: the colour plate first, then the ink, then the colour plate lifts.
- The caption rises in a 60 ms stagger.
- The index rows are set in the display face.

**Interactive and real-time motion**, **UI component design**.
- The index is a modal dialog: focus moves to Find, Tab stays inside, Esc closes and returns focus, `I` opens it. It carries a pointer-following cover preview.
- Previous and Next name the neighbours.
- The cursor names what a press will do (Drag, Open, View) and steps aside on inputs and under reduced motion.
- Reduced-motion map v2.1: `reduced_motion_state_map.py` returns PASS on `contracts/reduced-motion-map-v2.json`.

## v2: Heat Sheet (restyle and mechanism repair)

The v2 pass answers two pieces of feedback:
- **Restyle.** Ethan asked for Jonathan Zawada's *Hi This Is Flume* visuals, mixed with four of his pastiche extractions, as one language.
- **Repair.** Cases cut through each other, and moving off an open case snapped it shut.

**Motion art direction** and **UI art direction**.
- Synthesised five extracted design languages by mechanism rather than surface (`direction-v2.md`, mechanism-first map).
- Resolved the contradictions explicitly: colour, type, texture, motion, density, numbering.
- Wrote three structurally different routes (Heat Sheet, Cockpit Night, Monochrome Dossier) with falsification tests and selected Heat Sheet.
- Routed references: `anti-targets-and-reference-research.md` (mechanism-first map, fixation control), `direction-boards-and-element-collages.md`, `route-generation-and-convergence.md`, `signature-patterns-and-rules.md`.
- Helpers:
  - `check_direction.py` on `contracts/art-direction-record-v2.json`: PASS, no warnings.
  - `direction_matrix.py` on `contracts/direction-matrix-v2.json`: Heat Sheet first. Bookkeeping only.

**UI typography**, **UI colour**, **UI visual language**, **UI layout and composition**.
- Four families with one job each, chosen from a rendered specimen (`studies/type-specimen-v2.png`).
- Shells measured for text contrast, and the text colour on each is computed (`covers.ts: textOn`).
- Edge rails, capsules, the specimen label and the cockpit are recorded in `visual-system.md`.
- Production locations: `src/styles.css`, `src/fonts.css`, `src/catalogue.ts` (shells, layouts, capsule codes).

**Procedural motion** and **visual development for motion**.
- The patchwork was added after Ethan sent images of the Zawada artwork (a video frame, the packaging, the gatefold, the vinyl label). It is a seeded tile system in `src/tiles.ts`:
  - eight tile kinds;
  - a quilt composer that never repeats a neighbour's colour and lays diamonds across grid intersections;
  - an isometric tile cube;
  - strips.

  The mechanism is borrowed; the marks are not.
- The cover system has four deterministic layouts (quilt, block, horizon, specimen) on coprime cycles with sixteen shells.
- One fitting routine (`fitDisplay`) is shared by the covers and the page's giant title, so page and print use the same face and metrics.
- Evidence: `studies/cover-sheet.html`.

**Look development for motion**.
- The look thesis changed to glossy automotive shells in hard sun.
- A generated heat-field environment replaces the room environment.
- Neutral tone mapping keeps the shells' hues.
- A shadow-only floor anchors the rack on the page's printed horizon, which the stage computes from the floor's vanishing line.

**Motion foundations**, **interactive and real-time motion**, **3D motion design**.
- Each case owns gated `pull`, `turn` and `open` springs (`src/gates.ts`). The way out is pull, turn, open; the way back is close, turn back, retract. Only one case turns at a time, and the way home is stiffer than the way out.
- A presented case holds the front while the rack turns, then returns along the arc outside the rack.
- Reflow sinks visible cases through a clipped floor, re-slots them unseen and raises them from the front out.
- Helpers:
  - `spring_response.py` on `contracts/spring-case-{pull,turn,open,lift}.json`: all PASS, no overshoot. Settling times are 0.50, 0.58, 0.88 and 0.54 s.
  - A gate simulation (`scripts/simulate-gates.ts`, result in `evidence/gate-simulation.result.json`) runs the stage's own springs and gates through three interruption scenarios. All PASS:
    - minimum clearance while yawed: +0.023 units;
    - largest turn on a second case at the same time: 0.0007;
    - no case opens while unturned.
- Sampled sequences on a fixed-step review clock (`window.__rack.freeze()` and `step(ms)`) are in `evidence/review/sequence-*`.

**Kinetic typography** and **narrative and editorial motion**.
- Arrival: a once-per-session patchwork title card with the project count as its numeral. It is cut away in twelve scattered hard-cut batches (`src/ui/curtain.ts`).
- Signature: the giant title cuts out the moment the rack moves and stamps in on settle, with a two-frame misregistered copy in the case colour.
- The caption scans in left to right. The callout ring and leader draw on, then the label snaps.
- Feedback and result stay separate: the position number moves at once, and the words wait for the settle.
- Production locations: `src/ui/hero.ts`, `src/ui/caption.ts`, `src/styles.css` (`hero-*`, `scan`, `callout`).

**Accessible and inclusive motion**.
- Every new carrier has a reduced equivalent: `reduced_motion_state_map.py` on `contracts/reduced-motion-map-v2.json` returns PASS.
- The giant title is decorative (`aria-hidden`). The caption carries the title for assistive technology.
- Focus is ink on paper and lime in the cockpit.
- On narrow screens, vertical scroll belongs to the page.

**Data.** The live GitHub read now pages through every public repository (up to 1,000), so the catalogue has no 100-repository ceiling.

---

## v1 record (the first build; mechanism kept, visual sections superseded)

## Direction

**Motion art direction** (`motion-design-skills/skills/motion-art-direction`). Reframed the brief into a motion thesis: the collection is one revolving object; turning selects; the chosen case leaves the rack; reading happens inside the object. Three structurally different routes were written and compared (the drum, the index, the shelf) and the drum was selected with the index locked as an invariant.
Routed references: `brief-and-causal-concepting.md`, `hierarchy-exclusion-and-restraint.md`, `cross-domain-coherence.md` (decision sequence and case comparison), `critique-selection-and-convergence.md`, `production-feasibility-and-context.md`.
Helpers: `direction_matrix.py` on `contracts/direction-matrix.json` (ranking in `evidence/direction-matrix.result.json`, status WARN by design: the tool flags that a score is bookkeeping, not a decision).
Production locations: `direction.md`, the state model in `src/state.ts`.

**UI art direction** (`good-fuckin-frontend/deliverables/skills/ui/ui-art-direction`). Wrote the causal visual thesis, six anti-targets with failure signatures, two signature patterns (the extraction; the catalogue number as key) and the specialist briefs.
Routed references: `principles-to-visual-thesis.md`, `anti-targets-and-reference-research.md`, `route-generation-and-convergence.md`, `signature-patterns-and-rules.md`, `cross-medium-direction-briefs.md`, `critique-diagnosis-and-validation.md`.
Helpers: `check_direction.py` on `contracts/art-direction-record.json` (PASS with one warning about unequal representative states, recorded in `evidence/check-direction.result.json`).

## Visual system

**UI typography**. Roles before families; candidates rendered at intended sizes with the installed Fontsource files (`studies/type-specimen.html`, `.png`). Fraunces chosen for its optical-size range so one serif does display and reading; Archivo for its width axis so one grotesk does index, labels and spines. Canvas text cannot set variation axes per call, so each printed role is a separate face with the axes fixed in its descriptor (`src/fonts.css`), verified in `studies/canvas-axes.html`.
Routed references: `typeface-selection-and-voice.md`, `typography-as-form.md`.

**UI colour**. Semantic roles with measured WCAG pairs (`studies/contrast.py`): ink on stock 13.1, accent on stock 6.8, muted on stock 4.6, ochre lifted so stock text clears 4.5 on every case ink. The accent is scarce: current line, focus ring, open affordance.
Routed references: `semantic-roles-and-system-architecture.md`, `contrast-cvd-and-redundant-encoding.md`.

**UI visual language** and **visual development for motion**. The case grammar card (mass, axis, subdivision, negative space, the one drawn mark, the stop rule) and the edge and surface roles are in `visual-system.md`. Detail concentrates on the extracted case; rack-resolution inserts are repainted at hero resolution only for the current case (`src/stage.ts: paintHero`).
Routed references: `shape-grammar.md`, `edge-language.md`, `surface-material-and-depth.md`; visual development field references for shape language, silhouette hierarchy and detail hierarchy.

**UI layout and composition**. Split field: stage left, index right, one hairline; phones stack. Invariants and transformations are in `visual-system.md` and `src/styles.css`.
Routed references: `grid-systems-and-spatial-grammar.md`, `responsive-and-adaptive-composition.md`.

**Look development for motion**. Look thesis: printed insert under a satin coat on seamless stock under one soft key. Wedges for coat roughness (0.1, 0.25, 0.5) and key intensity (1.8, 2.4, 3.0) were rendered (`evidence/wedges/`) but are not perceptibly different in the software renderer available here; the authored values stay and a wedge on a real GPU is NOT RUN.
Routed references: look thesis and wedge plan (decision system and field reference), material vocabulary (decision system, core methods), light, colour and atmosphere.

## Mechanism

**Motion foundations**. Every continuous value is a spring so a retarget mid-flight keeps position and velocity; the rack is critically damped; nothing loops; the only one-way travel is the arrival. The caption separates feedback (the number) from result (the title).
Routed references: timing, easing and springs; interruption, reversal and retargeting; attention and temporal hierarchy.
Helpers: `spring_response.py` on `contracts/spring-rack.json`, `spring-extract.json`, `spring-open.json` (all PASS: no overshoot; settle to one percent at 0.64 s, 0.61 s and 0.92 s); `state_machine_lint.py` on `contracts/state-machine.json` (WARN: three transitions have no reverse, which is intended, since nothing returns to loading).
Production locations: `src/motion.ts`, `src/stage.ts` (`pos`, `extract`, `openness`, `camPush`, inspect springs), `src/ui/caption.ts`.

**Interactive and real-time motion**. The product state is owned by `src/state.ts`; the stage reports settle; drag keeps gesture velocity on release; wheel accumulates; taps open or select; README fetch is acknowledged in text, superseded by a newer open, and fails to a link. Degraded conditions drop to a low quality tier once; `?quality=low` forces it.
Routed references: state model and feedback; direct manipulation; loading and perceived time; runtime performance, fallback and QA.
Helpers: `reduced_motion_state_map.py` on `contracts/reduced-motion-map.json` (PASS).

**Spatial and camera motion** and **3D motion design**. The coordinate contract, pivots and the hinge are documented at the top of `src/stage.ts`. One camera move exists: a short push on open, reversible. The rack is an arc at twelve degrees per case tightening to five, so sixty cases never wrap round to meet; beyond sixty it becomes a helix. Cases beyond one hundred degrees from the front are not drawn.
Routed references: camera path and framing; transforms, pivots, hierarchies and coordinates; cloners, instancing and effectors; performance, LOD, instancing and memory.

**Procedural motion**. Inserts, spines and the position mark are deterministic functions of the entry and the catalogue size (`src/covers.ts`); the ten inks are assigned by accession number so neighbours differ.
Routed references: curves, easing, springs and dynamics (shared source with motion foundations).

## Editorial

**Kinetic typography** and **narrative and editorial motion**. The arrival is one finite sequence: the rack turns in while the name settles, then the subtitle and count, then the case comes out and the title appears. Line timing is a short offset rather than per-word choreography; the complete readable state is the default. The index does not stagger.
Routed references: temporal reading and cue timing; beats, pivots and consequences (decision sequences).
Production locations: `src/styles.css` (`settle-in`), `src/stage.ts` (`arrivalT`), `src/ui/caption.ts`.

## Access

**Accessible and inclusive motion**. Reduced motion is a second direction, not a deletion: positions snap, the booklet appears without sliding, the caption changes at once, the index scrolls without smoothing. The system preference is honoured and a visible control overrides it. The index is a listbox with arrow keys, Home, End and Enter; the status region announces the settled case; the booklet moves focus to Close and returns it. No flashing or luminance alternation exists. The no-WebGL path renders the same selection flat.
Routed references: reduced motion and alternate communication; essential information, captions and actions (decision sequence); vestibular and spatial comfort (decision sequence).
NOT RUN: screen-reader and switch-access sessions; a vestibular comfort review with people; a real-device phone test.

## Review

Frames in `evidence/contact-sheet.jpg`, captured by `scripts/review.mjs` from the built site in headless Chromium with SwiftShader at 1440 by 900 and 390 by 844, eleven and sixty cases, full and reduced motion, WebGL and flat. The software renderer runs at under fifteen frames a second, so end states were captured through a review-only snap hook and real-time playback is NOT RUN on a representative GPU.
