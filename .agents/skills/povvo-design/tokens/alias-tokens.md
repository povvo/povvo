# Alias Tokens

## Alias Tokens Contract

| Token | Role | Value | Use |
| --- | --- | --- | --- |
| `alias.surface.field` | field base | `color.field.paper` | protects semantic surface |
| `alias.line.instrument` | line | `color.line.cyan` | shared line and focus cue |
| `alias.type.display` | display | condensed display stack | font swap safety |

## Architecture Rule

Aliases are shallow and inspectable. Primitive tokens are raw authoring material. Alias tokens shield semantic decisions. Semantic tokens express intent by mode. Component tokens bind component parts to semantic roles. Component tokens must not reference primitives directly. CSS custom properties are the web runtime mechanism, while platform outputs preserve semantic names.

## Required Terms

This file covers Token, Alias target, Reason. Token decisions are deliberately sparse because the six-exemplar language is not a broad palette system. The strongest values are field, anchor, instrument line, inverse mark, texture, focus, and scan timing.

## Anti-Patterns

Do not flatten primitive, alias, semantic, component, mode, platform, transform, and drift rules into one token file. Do not add big cyan fills, arbitrary radius, heavy shadows, or raw component values. Do not rename tokens by appearance when intent must survive light, black-board, high-contrast, and reduced-motion modes.
