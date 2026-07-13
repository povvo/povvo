# Global Tokens

## Global Tokens Contract

| Token | Role | Value | Use |
| --- | --- | --- | --- |
| `color.field.paper` | Off-white inspection field | `#F4F6F1` | dominant light field |
| `color.field.grain` | Soft paper grain | `#DCE4DF` | subtle texture and pale diagram fill |
| `color.ink.anchor` | Black anchor ink | `#050706` | display anchors, slashes, board field |
| `color.line.cyan` | Muted cyan line | `#6E9DB2` | hairlines, focus, scan, ticks |
| `color.mark.inverse` | Pale inverse mark | `#D8ECF8` | marks on black board |

## Architecture Rule

Global tokens organize color ramps, type scale, spacing, radius, elevation, motion, density, and breakpoint scales. Primitive tokens are raw authoring material. Alias tokens shield semantic decisions. Semantic tokens express intent by mode. Component tokens bind component parts to semantic roles. Component tokens must not reference primitives directly. CSS custom properties are the web runtime mechanism, while platform outputs preserve semantic names.

## Required Terms

This file covers Token, Scope, Reference. Token decisions are deliberately sparse because the six-exemplar language is not a broad palette system. The strongest values are field, anchor, instrument line, inverse mark, texture, focus, and scan timing.

## Anti-Patterns

Do not flatten primitive, alias, semantic, component, mode, platform, transform, and drift rules into one token file. Do not add big cyan fills, arbitrary radius, heavy shadows, or raw component values. Do not rename tokens by appearance when intent must survive light, black-board, high-contrast, and reduced-motion modes.
