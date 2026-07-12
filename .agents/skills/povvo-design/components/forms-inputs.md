# Forms And Inputs

## Forms Covered

Text fields, text areas, search, selects, toggles, validation, helper text, and repair.

## User Or Maker Problem

This family makes functional UI feel like Povvo Spec-Scan without copying source material. It turns the measured field, black anchor, pale instrument line, and scan/crop logic into usable controls with states, recovery, and accessibility.

## Anatomy And Boundaries

| Component or module | Anatomy | Boundary | Related component |
| --- | --- | --- | --- |
| measured field | field, label, mark, state, optional action | owns one task or information cluster | feedback/status |
| choice tick | field, label, mark, state, optional action | owns one task or information cluster | feedback/status |
| search strip | field, label, mark, state, optional action | owns one task or information cluster | feedback/status |

## Variants

| Variant | Purpose | Visual difference | Behavioral difference |
| --- | --- | --- | --- |
| sparse | default quiet use | large field and one anchor | minimal feedback but visible state |
| dense | inspection or comparison | bounded label cluster | grouped navigation and recovery |
| black-board | identity or modal emphasis | near-black field and pale mark | used sparingly |

## States

| State | Visual behavior | Interaction behavior | Content behavior |
| --- | --- | --- | --- |
| Default | off-white or black field with clear anchor | available by pointer and keyboard | short visible label |
| Hover/focus | cyan bracket or dark underline | focus path is visible | no hover-only required text |
| Active/pressed | ink compresses or line shortens | fires once and exposes busy state | label stays stable |
| Disabled | muted ink and removed emphasis | reason is available when useful | content stays readable |
| Loading | scan sweep or static tick rail | duplicate activation blocked | progress text plain |
| Error | repair tick plus black label | focus moves to repair target | message says what to fix |

## Content And Naming Rules

Use compact verbs and nouns such as Apply, Inspect, Save, Next, Back, Retry, Index, and Review. Avoid hype and source-subject vocabulary. Tiny labels may decorate; required instructions use readable text and accessible names.

## Token Dependencies

| Part | Required token | Override boundary |
| --- | --- | --- |
| field | `surface.field` or `surface.black-board` | mode may change, role may not |
| text | `text.primary`, `text.inverse`, `text.micro` | no raw color in component styles |
| line | `border.hairline`, `border.focus` | thicken for contrast |
| motion | `motion.scan`, `motion.snap`, `motion.still` | reduced motion has a static branch |

## Accessibility And Localization

Keyboard behavior, visible focus, readable labels, text expansion, and non-color state meaning are mandatory. Compact visual marks sit inside platform-appropriate target areas. Long localized labels wrap into measured blocks instead of shrinking below legibility.

## Code And API Contract

Expose variant, density, tone, state, disabledReason, loadingLabel, and accessible name fields. Supported states are default, hover, focus, active, selected, disabled, loading, warning, error, and success. Unsupported visual variants must be rejected or documented as gaps.

## Examples And Anti-Patterns

Do: build the component from field, anchor, line, bracket, and measured text. Avoid: rounded promotional pills, big cyan fills, unlabeled icon controls, generic cards, source-subject metaphors, and decorative motion without state meaning.

## Related Patterns

Required terms covered: Fields, Validation, Error recovery. Related support files include behavioral states, perceptual patterns, semantic tokens, mode tokens, keyboard focus motion, and application rules.

Fidelity check: preserve the interrupted-aperture P, identical integrated and standalone geometry, matched filled and outline POVVO states, black and off-white dominance, pale cyan hairlines, tiny measured marks, active negative space, scan or bracket state logic, and exact text control. Reject alternate logo geometry, unrelated symbols, modular blobs, saturated cyan panels, glossy control-room styling, generic cards, product or lifestyle imagery, people-led subjects, sport content, copied source marks, and extra generated words.

