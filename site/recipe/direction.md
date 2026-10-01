# Direction record: the Barrett catalogue

Owned by `motion-art-direction` (brief and causal concepting, hierarchy and restraint, critique and convergence, production feasibility) and `ui-art-direction` (causal visual thesis, anti-targets, route comparison, signature patterns, specialist briefs). Routed references read before this record: `brief-and-causal-concepting.md`, `hierarchy-exclusion-and-restraint.md`, `cross-domain-coherence.md` (decision sequence and case comparison), `critique-selection-and-convergence.md`, `production-feasibility-and-context.md`; `principles-to-visual-thesis.md`, `anti-targets-and-reference-research.md`, `route-generation-and-convergence.md`, `signature-patterns-and-rules.md`, `cross-medium-direction-briefs.md`, `critique-diagnosis-and-validation.md`.

## 1. Reframe

| | |
|---|---|
| Apparent request | A GitHub Pages portfolio for roughly sixty public repositories: a PS2-style rotational selector of video cases that come off a rack, float, can be inspected, and open on the README. Editorial, creative, not the current Povvo Spec-Scan language. |
| Underlying problem | A visitor to a profile with sixty repositories has no way in. A flat list says nothing about which work matters or that one person made it. Ethan needs the collection to read as authored, and needs any single project to be findable fast. |
| Communication job | Through time: the scale of the collection becomes legible (there is a lot, and it is one object); the chosen project becomes singular (one leaves the group); reading becomes handling (the README is the insert inside the case). |
| Invariants | Repository metadata and README text come from GitHub and are authoritative. Each case links to its repository. The name is Ethan Lee Barrett. The site is static on GitHub Pages. Keyboard, screen reader, reduced motion and no-WebGL visitors can select, read and leave. No Spec-Scan carry-over (black and off-white with cyan, condensed sans and mono instrument look, construction lines, the aperture P). |
| Risk question | Can sixty text-bearing cases rotate at frame rate on a mid-range phone and stay legible, and does a rotational selector make finding a named project slower than a list? |

Motion is the right medium for the first two jobs (scale and singularity are spatial facts). It is not the medium for reading, so the README is never rendered inside the 3D object.

## 2. Motion thesis

- **Purpose:** make a collection of sixty repositories feel like one authored object and make the current choice unmistakable.
- **Audience and viewing condition:** recruiters, collaborators and curious developers on a laptop or phone, one visit of a few minutes, often arriving from a GitHub link.
- **What changes through time:** the rack's rotation (selection), one case's extraction (focus), that case's hinge opening (reading). Nothing else moves except one arrival reveal of the masthead and the index line that follows the current case.
- **Why it changes:** rotation because selection is a position in the collection; extraction because the chosen object must leave the group to become singular; opening because the content lives inside the object.
- **Attention events:** first, the rack turning into place as the name settles; second, the front case sliding out when the rack stops; last, the case opening and the page quieting around the insert.
- **Physicality model:** stylised rigid mechanism. Cases are hinged solids with mass; the rack turns like a damped mechanism, not a simulation. No gravity, no bounce theatre.
- **Primary falsifier:** a visitor cannot reach a named project faster than on the GitHub profile page, or rotation at real scroll speeds is uncomfortable.

## 3. Causal visual thesis

Because visitors arrive at sixty projects by one person with no idea which matter, organise the work as a single physical collection, cases with printed spines and inserts on a revolving rack, set into a quiet typeset catalogue page, so that scale reads at a glance, the chosen project reads as singular, and reading the README feels like turning a case over in the hand rather than scrolling a feed.

Perceptual goals, in order:

1. Orientation: one person's collection, catalogued. The masthead carries the name, the subtitle and the count.
2. Selection: the front case is the current one. It is the only extracted object, and its title is the only accented line in the index.
3. Relation: neighbouring spines show the order; the index mirrors the rack order; the catalogue number ties both.
4. Interpretation: printed inserts under a glossy sleeve say authored objects; per-case ink says each one is different; the still page says this is edited.
5. Reward: opening the case, the disc, the small print on the insert.

Governing tension: theatrical object, quiet page. The 3D object may be spectacular. The page around it is a printed catalogue: flat, typeset, still. Expression lives in the object and its three transitions; the chrome never animates decoratively.

## 4. Anti-targets

| Name | Why plausible | Failure signature | Countermeasure | Test |
|---|---|---|---|---|
| PS2 cosplay | The brief names the PS2 selector | Blue void, cube icons, console boot cues; the page reads as an emulator | Transfer the mechanism (rotation as selection, extraction as focus), not the costume | Remove the cases: does the page still belong to Ethan? |
| Dark portfolio default | Awwwards fashion | Near-black page, glowing accent, cursor trail, grain, marquee | Pale printed stock, one scarce accent, no decorative motion | Competitor reassignment: could another developer ship it unchanged? |
| Spec-Scan carry-over | The existing Povvo language is in the repo | Cyan line accents, condensed sans and mono instrument look, scanlines, the aperture P | Different stock, ink, families and mark system | Grep for cyan, Roboto Condensed, Plex Mono; visual check of the masthead |
| Carousel theatre | 3D invites it | Rack spins dramatically on every change, idle motion forever, parallax on scroll | Rotation is a spring that settles in under half a second; nothing moves without input | Watch thirty seconds with hands off: nothing moves |
| Cover art soup | Generated covers are easy | Gradients, blobs, noise; titles compete with art; spines unreadable | Inserts are typographic: title, number, language, year, one flat ink, one geometric mark derived from the number | Spine titles readable at rest size on a 1366 wide laptop |
| Reading inside the texture | 3D tempts it | README as a canvas texture: blurry, unscrollable, invisible to assistive tech | README is DOM text in a booklet panel; the 3D case only carries a short insert | Select text in the README; tab through its links |

## 5. Routes compared

Comparison contract: same repository data (the current public set plus a synthetic sixty), same states (rest, turning, extracted, open, reduced motion, phone portrait), same fidelity (written card plus a geometric rough), same criteria.

| | A. The Drum | B. The Index | C. The Shelf |
|---|---|---|---|
| One sentence | A helical revolving rack of cases fills the stage; turning it selects; the front case comes out and opens | A long typographic index is the hero; focusing a line summons that one case into a fixed window | A literal shelf runs across a room; scroll dollies the camera along it; the hovered case pulls out and the camera pushes in |
| Governing relationship | Object dominates, type annotates | Type dominates, one object illustrates | Camera dominates, objects are scenery |
| Strongest claim | The collection is one object you can turn in your hands | Finding is fastest and most accessible | Most cinematic; the room sells scale |
| Decisive trade-off | WebGL and GPU cost for sixty textured cases; needs a non-WebGL equivalent | The rack idea disappears; a list with a 3D widget would pass competitor reassignment | Horizontal travel fights phones; sixty cases is a long walk; camera travel is the largest vestibular risk |
| Falsification test | Mid-range phone drops below about 45 fps while turning, or spines are unreadable at rest | The page reads as a plain list with decoration | A visitor cannot reach item 47 within a few seconds, or reduced motion removes the navigation model |
| Reduced-motion equivalent | Instant positioning, crossfaded extraction, index as primary control | Already native | Would have to become route B |

Decision: **A, with B's index locked as an invariant, and C's camera reserved for one move.** Rewritten as one proposition: one revolving collection; the index and the rack are the same list rendered twice. The index is not a fallback. It is always on screen on wide viewports and is the primary control under reduced motion and without WebGL. The only camera move is a short, reversible push toward the case when it opens.

What the losing routes taught: B fixes the accessibility floor and the finding speed (the index must support type-ahead and sorting). C's falsification fixes the rule that no navigation depends on camera travel.

## 6. Signature patterns

**The extraction.** Purpose: make the current selection unmistakable and singular. Trigger: the rack's angular velocity falls below a threshold with a case at the front. Scarcity: at most one case is ever out of the rack; hover never extracts (hover only lifts the spine's brightness). Invariants: extraction travels along the case's outward normal toward the viewer with a slight rise and a quarter turn to show the cover; the index description updates only after extraction completes. Variables: distance scales with viewport; under reduced motion it becomes a crossfade of a flat rendition. Counterexample: extraction on hover, several cases out, cases that bob. Verification: rapid wheel scrubbing never shows two cases out; moving the rack retracts the extracted case first.

**The catalogue number as key.** Purpose: tie the 3D object to the typeset page. Rule: the accession number (order of repository creation, `No. 001` upward) is printed on the spine, the insert, the index line and the booklet header, and nowhere else. Scarcity: no other numbers appear in the chrome (no badge rows). Variables: three digits until the collection passes 999. Counterexample: stars, forks and dates competing with the number. Verification: the number is the first thing shared between the extracted case and the accented index line.

## 7. Locked, guided, open

- **Locked:** one revolving collection; one extracted case; README as DOM text; index mirrors rack order and drives the same state; quiet chrome with no decorative animation; catalogue numbers as the key; the name Ethan Lee Barrett; no Spec-Scan carry-over; equivalent paths for keyboard, screen reader, reduced motion and no WebGL.
- **Guided:** case proportions near a DVD case (135 by 190 by 15 mm); per-case inks from a printed-ink range of about ten muted hues; spine typography in a condensed grotesk width; serif display from spine size to masthead size; light rig of one key and soft environment fill on a pale stage; helix radius and pitch; sorting options in the index.
- **Open:** the insert mark system; sound (none in this version); dark mode (not in this version); how topics are surfaced.

## 8. Specialist briefs

Typography (`ui-typography`, later `kinetic-typography`): roles are masthead display, catalogue line, spine label, insert title, booklet reading text, chrome label. Voice: an editorial serif with real optical sizes against a sober grotesk with a width axis. Stress: sixty-character repository names on a spine, long READMEs, numerals in tables. Signature: the catalogue line that follows the current case. Anti-targets: generic editorial costume, display novelty, labels as texture.

Colour (`ui-color`, later `colour-and-light-motion`): pale printed stock, warm near-black ink, one scarce accent for the current state and focus. Ten muted inks for cases that never carry state. Light stays neutral; the open state lowers the page's tone slightly so the insert reads first. Anti-targets: gradient as intelligence, low-contrast luxury, accent on every surface, any cyan.

Layout (`ui-layout-composition`): wide viewports put the stage left and the index right as two columns under a one-line masthead; the caption for the current case sits under the stage. Phones stack stage over index. The booklet overlays the index column; on phones it is a full sheet. Quiet fields around the stage. Anti-targets: cards, centred hero sameness, chrome that animates.

Shape, surface, detail (`ui-visual-language`, `visual-development-for-motion`, `look-development-for-motion`): rigid cases with a glossy clear sleeve over a matte printed insert; one geometric mark per insert derived from the number; detail concentrates on the extracted case and the booklet header; everything else is quiet. Anti-targets: effect soup, texture as craft, radius sameness.

Motion (`motion-foundations`, `interactive-and-realtime-motion`, `spatial-camera-motion`, `3d-motion-design`, `procedural-motion`): rotation as a critically damped spring on a target index, interruptible and velocity-preserving; extraction and opening as finite transitions that reverse cleanly; one short camera push on open; no idle loops. Accessible equivalents owned by `accessible-and-inclusive-motion`.

## 9. Production feasibility

Delivery: static site built with Vite and TypeScript, three.js for the rack, deployed from `site/dist` by GitHub Actions to `povvo.github.io/povvo`. Data: a committed snapshot of public repositories refreshed at build time with the Actions token, then revalidated in the browser against the public GitHub API. READMEs fetched from `raw.githubusercontent.com` on demand, rendered with `marked` and sanitised with DOMPurify. Fonts self-hosted through Fontsource. Textures: one insert and one spine texture per case at modest resolution; the inside faces are generated only for the extracted case. Pixel ratio clamped on phones. Review: Playwright against the built site at 1440 by 900 and 390 by 844, with and without reduced motion.

Unknowns to prove early: spine legibility at rest; frame rate with sixty cases on a software renderer (the only one available here); texture memory on phones.
