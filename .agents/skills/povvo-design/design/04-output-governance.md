# Povvo Spec-Scan: Output Governance

## Prompt And Asset Rules

Prompt work starts from this `DESIGN.md` as the source-free context packet. Before writing model-facing prompt text, create a prompt-pack intake that names the asset route, target surface, final use, audience, dimensions or ratio, exact rendered text, measurable requirements, risks, approval gates, and blockers. Use `outputs/prompt-pack.md` for reusable prompt contracts and keep proof, provenance, review notes, and internal reasoning outside the model-facing prompt.

Positive prompt payload:

```text
Create a Povvo Spec-Scan asset centered on the canonical interrupted-aperture P: integrate it as the first letter of one large black "POVVO" wordmark and, when needed, detach the identical P as the standalone mark. Pair the finished black identity with its exact pale-cyan outline construction state. Place it on a warm off-white measured field with ruler ticks, registration crosses, sparse vector nodes, subtle halftone grain, and controlled scan-edge falloff. Keep black and off-white dominant; use pale cyan only for construction hairlines and instrument marks. Render no other readable text. Exclude alternate logo geometry, unrelated icons, modular blobs, people, sport subject matter, product imagery, saturated cyan panels, and generic futuristic interface styling.
```

Prompt constraints: translate palette, identity geometry, type, space, surface, motif, and interaction rules into visible prompt constraints; bind black to filled identity states and pale cyan to outline construction; state layout region-first; quote exact text; preserve one canonical P geometry; keep model settings outside prompt text.

Asset naming: use stable semantic names, for example `povvo-logo-design-language-banner.png` or `povvo-spec-scan-wallpaper.png`.

## Accessibility

Contrast compliance: normal text minimum 4.5:1; large text minimum 3:1; UI components and graphical objects 3:1 minimum; micro labels 7:1 preferred or duplicated in larger accessible text.

Colour independence: if color were removed, focus remains a bracket, selection remains fill or double frame, error remains label plus repair tick, loading remains tick rail or progress text, and success remains check or tick plus label.

Focus indicators: 2px equivalent bracket or outline, offset when needed, minimum 3:1 contrast, never hidden behind grain or crop. Motion: reduced motion stops scan sweeps and replaces them with static step or tick states. Alt text describes the visible artifact, object, or UI state.

Minimum text size: 15px for body at normal zoom, 10px for decorative micro labels, larger for required labels.

## Drift Boundaries

This system has drifted if any of these conditions are met:

- Palette drift: saturated cyan occupies a major surface instead of line, focus, scan, or accent use.
- Identity drift: the P aperture, bowl, stem, terminal, oblique angle, or integrated/standalone relationship changes.
- Type drift: the `POVVO` geometry changes, the outline state does not match the filled state, or body copy is set in logo style.
- Spatial drift: fields are filled evenly with cards, blobs, or decoration and no active silence remains.
- Surface drift: UI becomes glossy, metallic, transparent, crystalline, or product-like.
- Motion drift: motion implies spectacle rather than inspection and reveal.
- Interaction drift: states lack focus, labels, keyboard behavior, or reduced-motion equivalents.
- Component drift: an artifact invents a component not explainable by the recipes or support files.
- Prompt drift: generated output adds extra text, people, sport subject, source marks, or wrong palette roles.
- Accessibility drift: contrast, focus, keyboard, text size, or color independence fails.

## Implementation Checklist

- Uses the named language and non-negotiables.
- Uses semantic tokens before raw values.
- Includes applicable states: default, hover, focus, active, selected, disabled, loading, error, warning, and success.
- Uses component recipes or documents a real gap.
- Preserves accessibility obligations.
- Preserves reduced-motion behavior.
- Blocks prompt and generated-output drift.
- Can be built without opening source, proof, provenance, or validation files.

## Review Rubric

| Dimension | Pass condition | Fail condition |
| --- | --- | --- |
| Language fidelity | canonical P/POVVO identity, measured field, outline construction, crop, and silence preserved | alternate mark, unrelated icon, generic technical UI, or lifestyle styling |
| Palette | black/off-white dominate and cyan is subordinate | large cyan fills or muddy grey averaging |
| Typography | canonical POVVO geometry, matching filled/outline states, readable body, measured labels | approximate logo font, altered P, mismatched outline, or illegible microcopy |
| Space | field, axis, crop, and density burst controlled | random diagonals, uniform clutter, default card grid |
| Surface | flat field, black board, matte grain, controlled scan edge | glossy panels, product materials, or heavy shadows |
| Motion and states | scan/snap/hold with reduced-motion branch | spinner-only, flashy loops, missing states |
| Components | recipes followed and states named | invented controls without accessibility |
| Accessibility | contrast, focus, keyboard, labels, and motion pass | any blocker in text, focus, motion, or state meaning |

## One-Line Brief

Povvo Spec-Scan is a measured off-white and black identity language centered on one interrupted-aperture P, integrated into `POVVO`, detached as the standalone mark, and repeated only as matching filled and pale-cyan outline construction states.
