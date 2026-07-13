# Token Transforms

## Token Transforms Contract

| Token | Role | Value | Use |
| --- | --- | --- | --- |
| primitive color | DTCG color | hex to token JSON | build |
| typography | DTCG typography | style outputs | platform |
| transition | duration/easing | motion tokens | reduced branch |
| semantic token | CSS variable | mode expansion | web |

## Architecture Rule

Use W3C DTCG composite types for typography, border, shadow, transition, and related outputs where practical. Primitive tokens are raw authoring material. Alias tokens shield semantic decisions. Semantic tokens express intent by mode. Component tokens bind component parts to semantic roles. Component tokens must not reference primitives directly. CSS custom properties are the web runtime mechanism, while platform outputs preserve semantic names.

## Required Terms

This file covers Input, Output, Transform. Token decisions are deliberately sparse because the six-exemplar language is not a broad palette system. The strongest values are field, anchor, instrument line, inverse mark, texture, focus, and scan timing.

## Anti-Patterns

Do not flatten primitive, alias, semantic, component, mode, platform, transform, and drift rules into one token file. Do not add big cyan fills, arbitrary radius, heavy shadows, or raw component values. Do not rename tokens by appearance when intent must survive light, black-board, high-contrast, and reduced-motion modes.
