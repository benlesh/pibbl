# Donut slice evidence

Approved contract: `PieLayout` accepts `style.innerRadius`; nonempty rings
require finite `0 <= innerRadius < radius`, while a zero radius permits only a
zero inner radius. `PieSlice` paints and targets the same annular `Path`, so
the center hole passes input through. Labels use the annulus candidate radius
and reject a full box whose closest point enters the hole; `auto` retains the
existing outside-lane fallback.

The optional `revision` input opts into retained PieLayout preprocessing. Its
value must be a nonnegative safe integer. Without it, each PieLayout evaluation
creates a fresh cache key and reevaluates data/value/key/label callbacks; signal
reads in those callbacks remain tracked by the computed receivers.

Baseline: after building workspace package entries, the pre-change focused
`packages/viz/test/pie-layout.test.tsx` suite passed 4 tests in 14 ms test time
on 2026-09-30 using Node 24.15.0, pnpm 11.21.0, and Chromium. This was a
structural baseline only; concurrent browser work makes it unsuitable as a
comparative timing result.

Focused evidence after the change:

- `packages/viz/test/pie-layout.test.tsx` checks annular hit-through, complete
  box hole exclusion, strict-inside to auto-outside fallback, revision reuse,
  and default reevaluation.
- `packages/viz/test/pie-example.test.ts` loads the editable pie composition;
  it now contains a **Show donut** control.
- Fresh focused command: `corepack pnpm@11.21.0 exec vitest run
  packages/viz/test/pie-layout.test.tsx packages/viz/test/pie-example.test.ts
  --browser.headless --browser.ui=false` — 9 tests passed.

This was a slice ready for feedback. Documentation, package-consumer checks,
and independent review remain pending integration.

## Accepted-slice hardening

After feedback acceptance, the focused suite additionally proves that dynamic
signal branches inside cached value and label callbacks replace their old
dependencies; a write to a detached branch does not schedule work, while the
active branch updates the layout. It rejects zero-radius positive holes,
inverted/equal rings, negative values, and NaN. Keyed donut descendants retain
their hook state on source reordering, removed slices release their targets,
and disposal releases all remaining refs and targets.

Fresh hardening command: `corepack pnpm@11.21.0 exec vitest run
packages/viz/test/pie-layout.test.tsx packages/viz/test/pie-slices.test.tsx
packages/viz/test/pie-example.test.ts --browser.headless --browser.ui=false`
— 18 tests passed.
