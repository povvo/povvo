# Mode Tokens

## Mode Tokens Contract

| Token | Role | Value | Use |
| --- | --- | --- | --- |
| Light | `surface.field` | `#F4F6F1` | default field |
| Black-board | `surface.black-board` | `#050706` | identity emphasis |
| High contrast | `border.focus` | system outline | forced colors |
| Reduced motion | `motion.reveal` | static tick rail | no sweep |

## Architecture Rule

Modes are explicit overrides, not automatic inversions. Primitive tokens are raw authoring material. Alias tokens shield semantic decisions. Semantic tokens express intent by mode. Component tokens bind component parts to semantic roles. Component tokens must not reference primitives directly. CSS custom properties are the web runtime mechanism, while platform outputs preserve semantic names.

## Required Terms

This file covers Mode, Token, Override. Token decisions are deliberately sparse because the six-exemplar language is not a broad palette system. The strongest values are field, anchor, instrument line, inverse mark, texture, focus, and scan timing.

## Anti-Patterns

Do not flatten primitive, alias, semantic, component, mode, platform, transform, and drift rules into one token file. Do not add big cyan fills, arbitrary radius, heavy shadows, or raw component values. Do not rename tokens by appearance when intent must survive light, black-board, high-contrast, and reduced-motion modes.
