# Visual redesign notes

Trace retains its cobalt (`#2456d3`), midnight (`#142e46`), and lime (`#d4eb86`) identity. The redesign draws layout inspiration from [Teaflask](https://teaflask.com/) while keeping the learning workflow and Trace's own visual assets.

The direction is a quieter, editorial interface: a horizontal navigation header, generous spacing, a clear introductory statement, and prominent paths into the course library and importing your own reading. Original SVG motifs and locally embedded Instrument Sans and Newsreader typography carry the visual identity.

The functional scope remains source-backed reading, editable recall cards, a probability lab, local review scheduling, and portable backups. Visual changes should preserve the `trace-learning-v1` storage key and schema rather than resetting users' work.

See [`DESIGN.md`](../DESIGN.md) for the maintained design system and [`TEST-REPORT.md`](TEST-REPORT.md) for automated results and browser verification criteria. A passing DOM test or design lint is not a rendered-layout or accessibility audit.
