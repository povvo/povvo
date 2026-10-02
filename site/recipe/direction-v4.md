# Direction v4: floppy disks, a loading screen, and polish

**Request:** "let's take this time to enhance everything. For one we should add a quick loading section to the page and use that time to cache or whatnot so that the page runs smoothly. Then we can also go ahead and add a lot more polish, and all of the bells and whistles to make it extremely responsive and satisfying to use and interact with. Some surprising, innovative bits and pieces etc. I am actually thinking that we should use floppy disks instead of boxes."

The black metal and Helvetica language of v3 (`direction-v3.md`) stays. Three things change: the object, the way the page loads, and how it feels to handle.

## Disks

**The disk** (`src/floppy.ts`) is a 3.5" floppy at real proportions: 90 by 94 by 3.3 mm, in scene units of ten centimetres.

- **Body:** one extrusion with three rounded corners and one clipped corner. The write-protect and density holes are cut through it.
- **Shutter:** brushed steel that slides across. It is two plates with windows plus a cap round the top edge.
- **Head opening:** not cut. Its walls would be seen exactly edge on, and the software rasteriser leaked those walls through the shutter in front. A dark recess of exposed media lies under the shutter on each face instead.
- **Label:** a white sticker. The back carries a metal hub with its drive hole, and a write-protect slider that clicks between its two positions.
- **Materials:** black plastic with a soft coat, steel with fine streaks along the slide, and paper. Reflections are set per material (see defect 2).

**The label** (`src/labels.ts`) is what a demo disk would have had:
- the logo photocopied in black across the top;
- a photocopied night photograph under it (treeline, bare branches, ridge or moon, from `src/xerox.ts`);
- "Ethan Lee Barrett" and the language and year in small Helvetica at the foot.

One disk in five carries a black sticker with the white logo alone.

**The box replaces the rack** (`src/stage.ts`). The disks stand in an open black box, and browsing is flipping through them:
- The disks already passed lean towards the viewer at 34°, resting on each other.
- The rest lean back at 9°, so the gap opens at the current disk.
- Each disk's lean is its own spring. It stops hard against its neighbours with a small bounce, the way plastic disks clack together, and ticks as it passes the gap.
- The current slot is always at the same place. The box moves and the camera stays, so the eye never has to follow.

**Out of the box** (gated springs, `src/gates.ts`):
1. **Lift:** the disk slides straight up out of the box along its own plane.
2. **Turn:** it floats to the presentation spot, square to the viewer, just under the logo.
3. **Into the drive:** the shutter slides open, the disk turns on its side, and it slides into the drive slot on the left edge of the open sheet.

Coming back runs the other way: eject, turn back, then drop home with a clack. Only one disk is out at a time, and a disk never moves towards the viewer until its foot has cleared the disks leaning in front (`scripts/simulate-gates.ts`: PASS, minimum clearance 2.1 mm).

**Composition** (wide), as framed by on-screen proportion:
- the logo centred in a band across the top, from 9% to 41% of the stage height;
- the presented disk at 52%, 37% of the stage tall;
- the box at the foot, its current disk 23% of the stage tall, seen from above at about 35°, so the label tops show over the disks in front.

The light is also arranged for the black page:
- a cold key from high on the left, off the camera's axis, so the flat faces never mirror it into the lens;
- a rim light from behind;
- a soft spot straight down into the box at the gap;
- a faint pool of light behind the presented disk.

## The loading screen and caching

**The boot screen** (`src/ui/boot.ts`) is in the HTML, so it is the first paint. While it shows, the page draws the first view and hands off cleanly:
1. **Drawing:** the labels of the ten disks nearest the gap and the presented disk's full-size label are drawn, uploaded to the GPU (`initTexture`), and the shaders compiled (in parallel where the driver can).
2. **Progress:** the current project's logo comes up first, at the exact size and place the page logo will take. A row of tiny floppies fills as each disk is written.
3. **Exit:** the logo slides up into its place, unscaled because it is already drawn at that size. The box rises behind it, and the bar and caption fade in once it lands.

The page logo lays itself out underneath, already open, so the handoff is seamless. Any key, click or tap skips the boot; unfinished work carries on in the background. The minimum is 900 ms, and the review clock bypasses it.

**The art pipeline** (`src/art/`):
- **Workers:** logos and photographs are drawn by a pool of up to three module workers on OffscreenCanvas, in priority order. The presented disk comes first, then outward from the gap. Generation never drops a frame.
- **Persistent cache:** each drawing is kept in Cache Storage as WebP, keyed by a generator version, so a second visit decodes instead of drawing. Measured in the review container, the boot's label phase took 3.1 s on the first visit and 0.14 s on the second.
- **Fallback:** where workers or OffscreenCanvas are missing, the same generators run on the main thread, one job per macrotask.
- **Versioning:** bumping `ART_VERSION` discards older drawings.

**READMEs** are fetched, rendered and sanitised once, and the settled disk's README and its neighbours' are prefetched while the page is idle. Opening a disk you have just looked at costs nothing.

**The service worker** (`public/sw.js`) only handles same-origin requests:
- hashed build assets: cache first;
- the page and the snapshot data: network first, with the cache only as an offline fallback.

A deploy shows up at once, and a repeat visit without a network still opens the box. It never touches GitHub's API or READMEs.

## Feedback and polish

- **Sound** (`src/sound.ts`), off by default, behind the Sound control in the bar. Every sound is synthesised with WebAudio, so there is nothing to download:
  - a plastic tick as each disk passes the gap;
  - a lift, and a clack as a disk drops home;
  - the shutter's slide and snap;
  - the drive's slide and clunk, then the head stepping over the motor hum while it reads;
  - the eject's kick;
  - the write-protect click;
  - static under the page flicker.

  With sound on, ticks also give a 4 ms vibration on touch devices. Sounds are short, quiet and rate-limited.
- **Hover:** a disk in the box lifts a few millimetres under the pointer, and a label next to the pointer names it, since names are small in the box. Over the presented disk's shutter, the shutter slides partway open.
- **Handling:** the presented disk turns slightly towards the pointer. Drag it to turn it in the hand; flick it and it spins and comes to rest face up or face down, whichever it reaches. Face down shows the hub. Click the write-protect tab to toggle it; click the disk to turn it back; `F` turns it over.
- **The drive:** the sheet's left edge is a drive bezel with a slot sized to the disk and an activity light. The light flickers while the disk reads. The README comes up block by block (22 ms apart) once the disk is in and the text has arrived. A 1.6 s fallback means the text never waits on the animation. On close the sheet waits while the disk ejects, then leaves.
- **Keys:**
  - type a letter or two to jump to the next disk whose name starts with them;
  - Page Up and Page Down jump five;
  - Home and End jump to the first and last;
  - `I` opens the index.
- **Links:** `#/name` selects a disk and `#/name/readme` opens it. The address and the page title follow the disk you are on, so any view can be shared.
- **No WebGL:** the flat box draws the current disk flat and large, with two neighbours either side, smaller and dimmer.

## Accessibility and safety

- **Reduced motion:**
  - the boot is removed at once;
  - leans and gates resolve within a frame;
  - the README shows as soon as its text arrives;
  - there is no flicker.

  `evidence/reduced-motion-map-v4.result.json`: PASS.
- **Flicker:** the page flicker is as in v3, within WCAG 2.3.1.
- **Small blinks:** the drive light's blink is a 6 px light, far below the general flash area.
- **Contrast:** the palette is unchanged from v3. New elements:
  - the tooltip is black on white (21:1);
  - the boot's secondary text is `#8c8c8c` on black (6.25:1), and its disk outlines `#636363` (3.5:1, non-text);
  - the drive badge is `#8c8c8c` on `#0d0d0d` (5.8:1).
- **Screen readers:** the boot line is a live status region. The canvas stays decorative, and the caption, the status announcements and the index carry everything.

## Review

The frames are in `evidence/review/` and `evidence/contact-sheet.jpg`. They were captured in headless Chromium with SwiftShader, which is not a representative GPU.

| Condition | Observation | Action |
|---|---|---|
| Boot | First paint: the name, the row of empty disks, "Reading the box". The logo comes up, the disks fill, and the logo lands on the page's | Kept after one fix (5) |
| Settled | The logo, the floppy floating under it, the box lit at the foot | Kept after fixes (1 to 4, 6) |
| Turned over | The hub, the drive hole and the write-protect tab | Kept |
| Flipping, sixty disks | The disks passed fan towards the viewer, their shutters catching the light | Kept |
| Into the drive, eject | Shutter, turn, slide into the slot; the light reads; the README comes up; on eject the disk is out before the sheet goes | Kept |
| Index, reflow, filter | As in v3, with disks | Kept |
| Phone | The logo, disk and box in the field, with the caption under it; the sheet full screen without a drive | Kept |
| Reduced motion, no WebGL | Instant states, no flicker; flat disks under the logo | Kept |

**Defects found and repaired**
1. **Line across the shutter.** A thin line ran along the head opening's edge. Hiding parts and painting each a flat colour showed one depth sample per pixel of the opening's edge-on wall leaking through the shutter, even with the shutter moved 5 mm clear. The opening is no longer cut through the body (see Disks). The camera's near plane also moved from 0.1 to 1 unit, and the shutter and label stand further proud, for coarse depth buffers.
2. **Grey disks.** The disks were grey, not black. With only a scene environment, three.js applies the scene's intensity to every material and ignores each material's own `envMapIntensity`, so black plastic took as much of the bright studio as steel. Reflections are now set per material.
3. **Grey wash on flat faces.** The key light, close to the camera's direction, mirrored a broad highlight into the lens off every flat face. It moved high to the left.
4. **Shutter acne.** The shutter lies a fraction of a millimetre over the body, and the shadow map could not separate them. The shutter now casts shadows but does not receive them.
5. **Boot count.** The boot counted the full-size label as a disk ("12" for 11 disks). It now counts disks only.
6. **The box.** The box was cropped at the foot and too dark to read. It was raised and enlarged, and lit from above.

**Checks**
- Type check and build are clean: CSS 16 kB, app JS 79 kB, art worker 18 kB, three.js 572 kB, no webfonts.
- The gate simulation passed, the reduced-motion map passed, and the flicker is unchanged from v3.
- The review ran 65 frames with no page errors. The console showed only the expected 403s from the rate-limited GitHub API and 404s for the synthetic catalogue's READMEs (now more of them, because neighbours are prefetched). There were also three warnings that Playwright blocked the service worker in scenes run without the review flag.
- A functional run passed 13 checks:
  - the address and title follow the settled disk;
  - type-ahead jumps;
  - the tooltip names the disk under the pointer;
  - `F` turns the disk over;
  - sound turns on and plays without error;
  - opening sets `/readme`, and Escape ejects;
  - `#/sleuth/readme` opens sleuth on load;
  - the art is stored in Cache Storage (24 drawings);
  - the service worker registers;
  - a second visit boots;
  - an offline reload still opens the box.

**Not run:** real-GPU playback and frame timing, real phones (including vibration), assistive-technology sessions, a listening check of the sounds on real speakers, and a photosensitivity review by a person.
