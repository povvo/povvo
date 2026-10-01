# Visual system record

Owned by `ui-typography` (typeface selection and voice, typography as form), `ui-color` (semantic roles, contrast), `ui-visual-language` (shape grammar, edge language, surface and depth), `ui-layout-composition` (grid families, responsive composition), `visual-development-for-motion` (shape language, silhouette hierarchy, detail hierarchy field references) and `look-development-for-motion` (look thesis and wedge plan, material vocabulary, light and atmosphere). Evidence: `studies/type-specimen.html` and `.png` rendered with the installed Fontsource files; `studies/contrast.py` output.

## Typography

Roles decided from the jobs the text does, then the families chosen by rendered construction at intended sizes (specimen reviewed at 1440 wide).

| Role | Family and axes | Size and setting | Job |
|---|---|---|---|
| Masthead name | Fraunces, opsz 144, SOFT 30, WONK 1, weight 400 | 22 px in the chrome; 64 to 96 px in the arrival frame | identity; the only place the wonk axis is fully on |
| Catalogue title (caption, booklet header) | Fraunces, opsz 72, SOFT 0, WONK 0, weight 400 | 40 to 56 px, line height 1.0, tracking -0.01em | names the current project; repository slug shown with hyphens as spaces |
| Insert title (on the case) | Fraunces, opsz 96, SOFT 20, WONK 1 | drawn to texture, about 9 percent of insert width | the printed cover |
| Booklet reading | Fraunces, opsz 14, weight 400 | 17 px, line height 1.55, measure about 62ch | README prose |
| Booklet headings | Archivo, width 100, weight 600 | 20 to 28 px | README structure, distinct from the serif reading voice |
| Index line | Archivo, width 100, weight 400 | 16 px | the finder |
| Catalogue number | Archivo, width 85, weight 500, tabular figures | 12 to 13 px, tracking 0.04em | the key that ties rack, caption, index and booklet |
| Chrome label and meta | Archivo, width 90, weight 500, uppercase | 11 to 12 px, tracking 0.08em | quiet support text |
| Spine | Archivo, width 80, weight 600 number then 400 title | drawn to texture; about 44 percent of spine width | readable at rest on the rack |
| Code in READMEs | system monospace stack | 14 px | not a loaded family; technical content only |

Specimen observations: Fraunces holds character from spine size to masthead, and its optical sizes mean one family performs display and reading jobs, so a second serif is not justified. Newsreader read as classical and bookish, closer to a generic library costume. Instrument Serif is the current portfolio fashion and would fail competitor reassignment. Archivo's width axis gives spines a compact setting without a second grotesk. Long repository names (`claudikins-automatic-context-manager`, 36 characters) wrap to two lines at 40 px in a 480 px column and fit a spine at 15 px equivalent.

Rejected: a loaded monospace family (Spec-Scan carry-over and badge-row flavour), uppercase display, tracked-out headings.

## Colour

Semantic roles with their contrast pairs (WCAG 2.x ratios measured with `studies/contrast.py`):

| Role | Value | Pair and ratio |
|---|---|---|
| `--stock` ground | `#E9E5DD` | page and stage |
| `--stock-deep` | `#DCD7CE` | stage falloff, booklet rules; ink on it 11.4 |
| `--stock-raised` | `#F2EFE9` | booklet paper |
| `--ink` foreground | `#221F1C` | on stock 13.1 |
| `--ink-muted` secondary | `#6B655C` | on stock 4.6, used at 12 px and above only with weight 500 |
| `--rule` hairline | `#C9C3B8` | decorative, never text |
| `--accent` current and focus | `#1F3BC3` | on stock 6.8; stock on it 6.8 |

Case inks (ten, printed-ink range, stock text on each measured 4.3 to 7.6; ochre lifted to `#7A5810` to clear 4.5): oxblood `#7A2E2E`, teal `#2B6A6A`, ochre `#7A5810`, indigo `#3F3A8C`, moss `#4F6A2E`, plum `#6E3A62`, slate `#44586F`, rust `#8C4A22`, bottle `#2F5243`, graphite `#4A4642`. Assigned by accession number modulo ten, in that order, so neighbouring spines on the rack differ in hue family. Inks never carry state; the accent never appears on a case.

Scarcity rule: the accent appears on the current index line, the focus ring, and the open affordance. Nothing else.

Rejected: any cyan; a dark page; gradients as atmosphere.

## Shape, edge, surface

Grammar card for the case family:

- **Primary mass:** a tall slab in DVD proportion, 135 by 190 by 15 (scene units 1.35 by 1.90 by 0.15). Closed, it is one rectangular silhouette; its spine is a flat face, not a rounded book spine.
- **Dominant axis:** vertical. Everything on the case reads top to bottom: number, then title, then imprint.
- **Subdivision:** front leaf, back leaf, spine; inside, a flat tray with a disc hub on the back leaf. Outer corners of the leaves carry a small radius (about 1.5 percent of width); the hinge edge stays square.
- **Negative space:** the insert keeps a stock margin of 3 percent around its ink field, like a printed sheet trimmed inside the sleeve. The spine has no margin.
- **Repetition:** sixty near-identical slabs; variation is ink, title length and the position mark only.
- **Signature detail:** the position mark, a thin ring with a filled dot at the case's angle on the rack, bottom right of the front insert and repeated in the booklet header. It is the only drawn graphic.
- **Stop rule:** no illustration, no logos, no language icons, no stars on the insert beyond the small imprint line.
- **Counterexample:** a cover with artwork, a gradient field, or a large ghosted number.

Edge hierarchy: the sleeve silhouette is a hard edge against the stage; the insert margin is a found edge in stock; the index column is separated from the stage by one hairline and a change in paper tone, not a card; the booklet is a raised paper with a hairline and a soft contact shadow where it meets the page.

Surface roles: ground (stock), stage (stock with a radial falloff of a few percent, drawn in CSS behind a transparent canvas), raised paper (booklet). No sunken or modal roles. The booklet dims the stage by lowering the canvas opacity slightly rather than adding a scrim.

## Material and light (look thesis)

Look thesis: a printed paper insert under a satin plastic sleeve, photographed on seamless stock under one soft key. Observable behaviours: a broad soft highlight that travels across the sleeve as a case turns; the insert's ink stays matte and readable under the coat; the spines in the rack separate by shadow, not by outline.

Material ingredients: body is the printed insert (`MeshPhysicalMaterial` with the insert texture, roughness 0.6, metalness 0); coat is a clear layer (clearcoat 1.0, clearcoat roughness 0.25); edge faces use the ink darkened by about 15 percent with the same coat. No fuzz, no wear, no grain.

Light rig: one key directional light from upper left front, warm-neutral white, with shadows; environment fill from a room environment map through PMREM at about half strength; one weak cool rim from behind right for edge separation on the rack. ACES filmic tone mapping with exposure near one, sRGB output.

Wedge plan (to be rendered on the extracted case at rest and mid-turn): coat roughness 0.1, 0.25, 0.5; key intensity 1.8, 2.4, 3.0; insert roughness 0.45, 0.6, 0.8. Falsifiers: a highlight that reads as glass or a mirror; the insert text losing contrast under the highlight; spines merging into one slab at rest.

Anti-targets: wet-look glass, metallic sheen, a dark void behind the rack, grain overlay.

## Layout

Spatial family: a split field. On wide viewports two columns under a one-line masthead: the stage (fluid, left) and the index (fixed width between 320 and 480 px, right) separated by one hairline. The caption for the current case sits bottom left over the stage. The footer carries input hints in one line.

Invariants that survive transformation: the index stays adjacent to the stage and reflects the same selection; the current title stays visible with the stage; the open affordance stays reachable; reading order is masthead, stage caption, index, footer.

Below 1024 px: stack the stage (58 percent of the small viewport height) over the index; the caption overlays the stage bottom; the booklet becomes a full-height sheet. Below 480 px the masthead drops the subtitle.

The booklet: on wide viewports it slides over the index column at the index column's width; it is raised paper with a header (position mark, number, title, description, meta, "Open on GitHub"), the README body and a close control. Esc closes.

Quiet fields: the stage above the caption, the masthead, the index gutter.

Rejected: cards, a centred hero, a three-column dashboard, animated chrome.
