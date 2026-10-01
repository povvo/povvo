# Parked

The visual language of the Heat Sheet versions (v2 to v2.1) and the type experiments, set aside
when the site was stripped back to a plain black-and-white baseline (recipe/baseline.md). None
of this is built or type-checked; it is kept so that pieces can be brought back on purpose.

- `tiles.ts` — the patchwork tile system (quilts, diamonds, tile cube, strips).
- `metal.ts` — the black metal logo generator.
- `covers-heat.ts` — the patchwork cover system (quilt, block, horizon, specimen), vinyl disc.
- `styles-heat.css` — the Heat Sheet stylesheet at v2.1 (heat field, grain, two-plate title,
  index preview, cursor, curtain).
- `fonts.css` — canvas faces for Anybody, Martian Mono and Bodoni Moda.
- `type/*.css` — the five type systems compared in recipe/studies/type-systems.png and
  type-metal.png (geometric, swiss, wide, editorial, metal).
- `ui/hero.ts` — the giant title at the foot of the stage, with its two-plate print.
- `ui/curtain.ts`, `ui/cursor.ts`, `ui/flicker.ts` — arrival curtain, labelled cursor, page flicker.

Font packages they used were removed from package.json; reinstall the ones a piece needs.
