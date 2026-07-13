# Povvo Spec-Scan: Foundations

## Palette System

Palette thesis: the system is polarized between off-white field and black identity, with muted cyan reserved for outline construction, instrument lines, and scan glow.

Semantic tokens:

| Role | Token | Hex | Use |
| --- | --- | --- | --- |
| Off-white inspection field | `color.field.paper` | `#F4F6F1` | dominant light field |
| Soft paper grain | `color.field.grain` | `#DCE4DF` | subtle texture and pale diagram fill |
| Black anchor ink | `color.ink.anchor` | `#050706` | display anchors, slashes, board field |
| Muted cyan line | `color.line.cyan` | `#6E9DB2` | hairlines, focus, scan, ticks |
| Pale inverse mark | `color.mark.inverse` | `#D8ECF8` | marks on black board |
| Deep teal edge | `color.edge.teal` | `#0B2B34` | scan falloff only |
| Warm halftone grain | `color.texture.warm` | `#B5A293` | crop texture only |
| Error repair | `color.status.error` | `#B24A32` | repair cue with text and shape |
| Success repair | `color.status.success` | `#287F76` | success cue with text and shape |

CSS variable seed:

```css
:root {
  --povvo-surface-field: #F4F6F1;
  --povvo-surface-grain: #DCE4DF;
  --povvo-ink-anchor: #050706;
  --povvo-line-cyan: #6E9DB2;
  --povvo-mark-inverse: #D8ECF8;
  --povvo-edge-teal: #0B2B34;
  --povvo-text-primary: #050706;
  --povvo-status-error: #B24A32;
  --povvo-status-success: #287F76;
}
```

Contrast obligations: `text.primary` on `surface.field` uses 4.5:1 minimum and 7:1 preferred for micro labels. `text.inverse` on `surface.black-board` uses 4.5:1 minimum and visual halation review. `border.focus` uses 3:1 minimum plus shape backup. State color always has non-color backup.

Forbidden uses: large saturated cyan surfaces, pale cyan body copy without contrast repair, warm halftone as a universal background, or cyan filled logo states.

## Typography System

Type thesis: typography behaves as identity object plus annotation. The canonical display voice is the custom oblique `POVVO` wordmark. Its first `P` uses a heavy stem, broad rounded-rectangular bowl, one horizontal aperture, and a compact forward terminal. The same geometry detaches as the standalone mark. The task voice is neutral, readable, and close to the thing it labels.

Type roles:

| Role | Family | Weight | Size range | Use |
| --- | --- | --- | --- | --- |
| Identity wordmark | custom interrupted-aperture oblique geometry | 900 | 48 to 180px | `POVVO` and standalone `P` only |
| Display anchor | condensed italic or extended grotesk | 800 to 900 | 48 to 180px | headings that do not impersonate the logo |
| Section heading | condensed grotesk | 700 to 800 | 24 to 48px | short panel titles |
| Body | neutral grotesk | 450 to 650 | 15 to 18px | readable task copy |
| Micro label | square grotesk or mono fallback | 600 to 700 | 10 to 12px | ticks, metadata, coordinates |
| Utility numeral | tabular mono or grotesk | 600 to 800 | 11 to 18px | indexes and values |

Scale: base 16px; hand-tuned optical scale using 12, 16, 24, 40, 64, 96, and 144px anchors. Display line height is 0.78 to 0.92. Body line height is 1.35 to 1.55. Labels use 1.1 to 1.25. Maximum line length is 72 characters for body and 42 for dense panels.

Microtype rules: use tabular numerals for indexes and measurement labels. Never reconstruct the logo from an approximate font, stretch it, change the P aperture, or alter its counters. Keep body text at 15px minimum in UI. Tiny labels can be decorative; required labels need accessible duplicates or larger size.

## Spatial System

Space thesis: the layout is a field with measured interruptions. It uses large quiet regions, one anchor, diagonal or ruler-aligned guides, and density that arrives as a bounded event.

Base unit: 8px. Grid: 12 columns desktop, 4 columns mobile, 16 to 24px gutters, 24 to 64px margins. Density range: sparse by default, compact for panels, dense only inside bounded inspection clusters.

Spacing scale:

| Token | Value | Use |
| --- | --- | --- |
| `space.025` | 2px | hairline offsets and tiny tick gaps |
| `space.050` | 4px | bracket inset and optical nudge |
| `space.100` | 8px | compact rhythm |
| `space.150` | 12px | microcopy clusters |
| `space.200` | 16px | default component padding |
| `space.300` | 24px | panel gutters |
| `space.500` | 40px | field buffers |
| `space.800` | 64px | poster margins and hero silence |

Composition rules: establish a blank field before adding labels; place one dominant anchor per frame; use hairline frames and crop edges instead of floating card stacks; keep diagonal construction lines subordinate to content; on mobile, preserve anchor, state, and label before decorative marks.

## Surface And Material System

Surface thesis: Povvo surfaces are flat measured fields, black identity boards, outline construction plates, and printed textures. Depth comes from crop, border, contrast, grain, and optical falloff.

Surface roles:

| Surface | Description | Implementation approach |
| --- | --- | --- |
| Primary field | off-white measured plane | solid token background, optional low grain |
| Ground | page or screen base | off-white or black-board mode with stable margins |
| Raised | spec plate or action strip | border, spacing, and contrast |
| Overlay | modal or identity board | black or off-white board with hairline frame |
| Critical | repair or warning strip | structural mark, label, and accessible state color |

Texture rules: texture is subtle in UI and stronger only in identity studies or generated print-like assets. No transparent, crystalline, metallic, or product-object material is part of the language. Material vocabulary: matte field, printed grain, black board, pale inverse mark, scan aperture, vector line, outline wordmark, slash bar, registration target.

## Motion System

Motion thesis: motion is inspection, not speed. It scans, brackets, reveals, cuts, or holds.

Duration tokens: instant 0ms for reduced motion; fast 90 to 140ms for focus and selected marks; default 240 to 420ms for scan reveal; slow 420 to 600ms only for nonessential ambient scan with pause.

Easing: enter uses `cubic-bezier(0.2, 0, 0, 1)`; exit uses `cubic-bezier(0.4, 0, 1, 1)`; scan movement is linear or near-linear.

Motion rules: use scan for reveal, loading, and inspection; use snap for focus and selection; keep text, forms, and errors still; loading over 500ms shows readable status; reduced motion replaces sweep with static tick rail, before/after state, or progress bar.

