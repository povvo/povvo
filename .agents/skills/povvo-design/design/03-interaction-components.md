# Povvo Spec-Scan: Interaction And Components

## Interaction And States

Feedback density: one action produces one structural mark, one text state, and at most one motion event. The interface withholds decoration but not task feedback.

State anatomy:

| State | Visual change | Copy behavior | Accessibility rule |
| --- | --- | --- | --- |
| Default | off-white field, black text, cyan only as structural hairline | short noun or verb | normal text 4.5:1 |
| Hover | hairline thickens or anchor darkens | no required new copy | not color-only |
| Focus | 2px cyan bracket plus black or pale tick | accessible name present | 3:1 non-text contrast |
| Active | ink compresses or surface settles | label stays visible | no target movement |
| Selected | black fill, double frame, or underline | selected named when ambiguous | shape backup |
| Disabled | muted ink and removed emphasis | reason when useful | readable explanation |
| Loading | scan line, tick rail, or skeleton field | short progress phrase | reduced branch |
| Error | red-orange tick, black label, repair text | direct repair instruction | not color-only |
| Warning | dark or amber tick interruption | consequence before action | icon or shape backup |
| Success | blue-green check or stable tick | past-tense confirmation | motion optional |

Silence rule: silence is allowed for decorative fields, completed states, and passive identity boards. It is not allowed for errors, disabled reasons, loading delays, destructive actions, or keyboard focus.

## Component Recipes

### Spec Button

Intent: trigger an action while preserving measured field language. Anatomy: rectangular or underline field, short label, optional slash mark, focus bracket, loading tick. Construction: off-white background, black label, tiny radius, 16px horizontal padding, 2px focus bracket, 120ms snap. Variants: primary black fill, secondary off-white outline, danger with repair tick, icon-labelled compact. Forbidden: rounded gradient pills, cyan fills, unlabeled icons, and hover-only labels.

### Measured Input

Intent: capture data in a field that looks like a labelled spec area. Anatomy: label, value area, lower rule, helper text, status tick, optional unit label. Construction: off-white plate, black text, cyan focus bracket, 16px padding, 44px target height, error text near the field. Variants: text, search, coordinate, select, checkbox/tick, toggle. Forbidden: placeholder-only labels, tiny required text, color-only validation, and glossy filled controls.

### Ruler Navigation

Intent: orient a user across sections. Anatomy: route label, tick rail, active underline, focus bracket, optional count. Construction: top or side rail, compact labels, black active state, pale cyan focus, arrows within tab groups. Variants: top ruler, side ruler, stacked mobile, black-board inverse. Forbidden: overstuffed menu bars, hidden focus, and route state by cyan alone.

### Scan Progress

Intent: show work, reveal, or sequence status. Anatomy: field, sweep or tick rail, progress label, retry or pause when needed. Construction: muted cyan sweep or static ticks, black status text, determinate value when possible, 320ms scan loop with pause. Variants: determinate, indeterminate, step index, product reveal. Forbidden: spinner-only feedback, endless shimmer, and motion with no reduced branch.

### Spec Panel

Intent: display content, data, or generated asset review in a measured cluster. Anatomy: title, anchor value, micro labels, guide rules, optional preview, status strip. Construction: off-white plate, black heading, low grain, hairline borders, dense grouping only inside the panel. Variants: sparse, dense, split, black-board. Forbidden: decorative card shadows, random badges, illegible metadata, and panels filled with cyan.

### Identity Construction Module

Intent: present the canonical identity as both finished mark and visible construction. Anatomy: filled `POVVO`, outline `POVVO`, filled standalone `P`, outline standalone `P`, registration marks, optional ruler rail. Construction: the filled and outline states use identical geometry and spacing; black carries the finished state, while pale cyan carries only the construction state. Variants: light field, black-board inverse, large wordmark, compact standalone mark. Forbidden: alternate P geometry, unrelated icons, modular blobs, fake control points, cyan-filled marks, or approximate-font reconstruction.

