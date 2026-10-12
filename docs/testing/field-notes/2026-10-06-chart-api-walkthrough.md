# Chart API execution walkthrough — 2026-10-06

> **Historical status: Dated implementation and verification evidence; current code and public contracts define shipped behavior.**

## Status

Approved scope F0, M1–M6, I1–I5 and E1–E3 is implemented, hardened and verified.
V0 closeout is complete with an explicitly recorded repository-wide gate blocker:
an unrelated shared design draft fails documentation-banner and formatting rules.
All unaffected stages passed independently. No chart slice remains merely runnable
or awaiting hardening. Autonomous visual acceptance is provisional; the demo tour
still deserves hands-on product review, especially domain gestures and compact layouts.

No statistical estimation, network/hierarchy/geography work, public chart container,
automatic aggregation, second scheduler, or unrelated runtime redesign was added.

## API inventory and implementation

All additions import from `@pibbl/core/viz`.

| Addition                                          | Contribution                                                                                                          | Source and contract                                                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AreaSeries`                                      | Fills an ordered continuous series to an explicit numeric baseline; gaps split runs.                                  | [Implementation](../../../packages/core/src/features/viz/lib/area-series.tsx), [API](../../site/api/components/area-series.md)                   |
| `IntervalBandSeries`                              | Fills between paired numeric bounds, rejecting inverted intervals.                                                    | [Implementation](../../../packages/core/src/features/viz/lib/interval-band-series.tsx), [API](../../site/api/components/interval-band-series.md) |
| `stepBefore`, `stepAfter`, `stepMidpoint`         | Immutable named curve definitions shared by line, area and band marks.                                                | [Implementation](../../../packages/core/src/features/viz/lib/step-curves.ts), [API](../../site/api/functions/series-curves.md)                   |
| `monotoneX`                                       | Shape-preserving mapped-x cubic interpolation; rejects duplicate/direction-changing x and crossing interval geometry. | [Implementation](../../../packages/core/src/features/viz/lib/monotone-curve.ts), [API](../../site/api/functions/series-curves.md)                |
| `SeriesCoordinate`, `SeriesAccessor`              | Let existing LineSeries, PointSeries and PlotSeries preserve numeric/string PointScale identities.                    | [Types](../../../packages/core/src/features/viz/lib/types.ts), [Line API](../../site/api/components/line-series.md)                              |
| `panDomain`, `zoomDomain`                         | Pure bounded navigation via a resolved continuous scale; fixed readonly domain return.                                | [Implementation](../../../packages/core/src/features/viz/lib/domain-navigation.ts), [API](../../site/api/functions/domain-navigation.md)         |
| `SequentialColorScale`, `useSequentialColorScale` | Two-stop clamped numeric color mapping with immutable stops.                                                          | [Implementation](../../../packages/core/src/features/viz/lib/sequential-color-scale.ts), [API](../../site/api/components/color-scales.md)        |
| `DivergingColorScale`, `useDivergingColorScale`   | Three-stop mapping with explicit asymmetric center.                                                                   | [Implementation](../../../packages/core/src/features/viz/lib/diverging-color-scale.ts), [API](../../site/api/components/color-scales.md)         |
| `ThresholdColorScale`, `useThresholdColorScale`   | Explicit finite ascending boundaries and exact bucket ownership.                                                      | [Implementation](../../../packages/core/src/features/viz/lib/threshold-color-scale.ts), [API](../../site/api/components/color-scales.md)         |

Related readonly props, resolved mapping, stop/band, and navigation constraint
types are exported and covered by public consumer probes. Runtime exports,
Studio declarations and documentation agree. [Public guide](../../site/learn/guides/data-visualization.md).

## Numbered Studio tour

Start the local server if needed:

```sh
corepack pnpm@11.21.0 -C playground run playground:dev --host 127.0.0.1 --port 5198
```

Resize each preview to 1000×640, 560×300, 360×300, 320×260 and 360×640.
Keep controls, source notes and selected state visible. All use checked-in data;
no network data request is needed to run a lesson.

1. [Baseline-filled area](http://127.0.0.1:5198/#/examples/composition/viz-area-basics): switch the 330/335 ppm reference, omit/restore June, inspect original months. The fill is distance from the reference, not emissions.
2. [Observed temperature interval](http://127.0.0.1:5198/#/examples/composition/viz-interval-temperature): inspect Central Park January 2020 daily min/max temperatures, switch outlines and a deliberate gap. These are observed extrema, not confidence intervals.
3. [Policy steps](http://127.0.0.1:5198/#/examples/composition/viz-policy-steps): compare step geometries. Step-after holds the published Federal Reserve 2022 target interval until the next effective date; the other placements are explicitly geometry illustrations.
4. [Monotone CO₂](http://127.0.0.1:5198/#/examples/composition/viz-monotone-climate): toggle linear/smooth and a missing observation. Inspect measured values rather than interpolated claims.
5. [Categorical series](http://127.0.0.1:5198/#/examples/composition/viz-category-series): reverse PointScale, create/restore a gap, inspect six original month identities. No string-to-number coercion.
6. [Threshold segments](http://127.0.0.1:5198/#/examples/composition/viz-threshold-segments): change the reference and inspect crossings. Application code splits linear geometry at shared vertices while preserving original records.
7. [Population stack](http://127.0.0.1:5198/#/examples/composition/viz-population-stack): switch absolute totals and percentages. The denominator is CA+TX+FL only. 2020 is the Census estimates base; 2022 and 2023 are July estimates.
8. [Linked inspection](http://127.0.0.1:5198/#/examples/composition/viz-linked-inspection): hover/tap, pin, clear, and use arrows/Home/End/Escape. The two plots share a timestamp key; the second is explicitly ppm minus 330. Signal replacement keeps surviving keys and retires removed ones.
9. [Controlled domain exploration](http://127.0.0.1:5198/#/examples/composition/viz-domain-exploration): drag nearest overview handles or the window, cancel with Escape, zoom via buttons/wheel, and navigate the focused detail with keys. Domain constraints remain application-owned; capture, resize, external updates, and cancellation are tested.
10. [Small multiples](http://127.0.0.1:5198/#/examples/composition/viz-small-multiples): switch shared/independent y domains and inspect a month position across four quarters. This aligns first/second/third month, not the same calendar date. Tall narrow layout becomes one column.
11. [Area and sign symbols](http://127.0.0.1:5198/#/examples/composition/viz-size-symbols): inspect six states and toggle sign shapes/circles. Area represents absolute July 2022–July 2023 population change, while symlog y and readout retain sign. Circles/squares have equal area for equal magnitude.
12. [Color encodings](http://127.0.0.1:5198/#/examples/composition/viz-color-encodings): switch sequential/diverging/threshold mappings, widen the domain/boundaries, tap months and navigate with keys. Exact values and all month identities stay visible. Keys derive from the same immutable mapping as cells; the diverging center is an authored reference.

Each implementation lives in [the composition source directory](../../../packages/scenarios/src/learning/composition/), named by its route plus `.example.tsx`.

## Minimal examples

- [Area](../../site/minimal/viz/area.tsx)
- [Interval band](../../site/minimal/viz/interval-band.tsx)
- [Step curves](../../site/minimal/viz/steps.tsx)
- [Monotone curve](../../site/minimal/viz/monotone.tsx)
- [Categorical coordinates](../../site/minimal/viz/categories.tsx)
- [Bounded navigation](../../site/minimal/viz/navigation.tsx)
- [Dedicated color mappings](../../site/minimal/viz/colors.tsx)
- [Executable registry](../../site/minimal/viz/registry.json)

## Decisions and limits

- Stacks, segmented styling, pinning, brushing, small multiples and size/symbol
  encoding remain public-API recipes. Core Text/shapes/layout supply prose and
  keys. No redundant ChartText/LegendItem, generic scale hook, or chart-global
  interaction manager was introduced.
- Existing `curve="linear"` remains supported. Nonlinear choices are named typed
  definitions. Point categorical widening applies to existing line/point/custom
  marks; numeric queries and interval/area accessors remain numeric.
- Color inputs require six-digit hex. Interpolation is rounded encoded-sRGB,
  not perceptually uniform or linear-light; no default palette or inversion is
  promised. Nonfinite values reject. Exact values/text and sign shapes provide
  alternatives to color-only interpretation.
- Threshold is the demonstrated discrete family. Ordinal, quantize and quantile
  color families remain deferred; no hidden statistics or distribution inference.
- Keys are application-rendered from resolved stops/bands. Providers allocate no
  plot box, target or scheduler and cannot cross Layer ownership boundaries.
- Canvas interaction does not produce semantic DOM or an accessibility tree.
  Production applications still own equivalent semantic access. These examples
  exercise focus and keyboard behavior within Pibbl's existing contract.
- The five tested allocations are a stated supported demo matrix, not a promise
  of arbitrary-size readability. No visual baseline was rewritten for this work.

## Verification ledger

Environment: Node 24.15.0, pnpm 11.21.0, Playwright Chromium on this macOS checkout.

- Baseline aggregate `corepack pnpm@11.21.0 trust` passed before new slices. This is
  not evidence for the integrated final tree.
- Integrated `corepack pnpm@11.21.0 build` passed, including website minimal
  validation and generated public API pages.
- `node tooling/verify-packed-viz.mjs` passed: packed runtime export allowlist,
  Bundler/NodeNext public probes, shared core identity, private boundaries and
  independent positional/curve/color family tree shaking.
- `node tooling/verify-studio-pivot.mjs` passed: source, built and editor public
  declaration parity.
- Focused native browser tests and actual Studio screenshots cover all twelve
  examples at the five allocations. See the [execution note](2026-10-06-chart-api-execution.md)
  for intermediate failures and corrections.
- Final chart suites: `corepack pnpm@11.21.0 exec vitest run packages/core/test/features/viz --browser.headless --browser.ui=false` and the same command with `--mode built`: **348 passed, 2 skipped in each mode** (61 passed files, 2 skipped files). Skips are the explicitly opt-in `VITE_PIBBL_VIZ_PERF` workload and `VITE_PIBBL_VIZ_STRUCTURE` dense-pie diagnostic; no functional chart test is skipped.
- Color validation was corrected test-first for sparse JavaScript arrays: every slot now passes finite-value or hex-color validation. The fresh public color batch passed 14 tests, followed by refreshed full chart source/built, packed and editor checks.
- Repository browser coverage: all 26 batches covering 413 discovered files pass after updating the exact lesson inventory from 96 to 108 and adding explicit API coverage. Batches 1–11 remained passing; batch 12 was corrected and rerun; batches 13–26 were completed. Seven optional diagnostics were skipped: the two viz checks above, the displacement benchmark (`VITE_PIBBL_DISPLACEMENT_BENCH`), two controlled event timing tests, and two DevTools profiling tests. Timing/profile flags are opt-in, not default correctness gates.
- Remaining static/package stages passed independently: Studio docs/catalog, package/website builds, production search boundary, typecheck, code lint, source/built playground builds, and `trust:package`.
- `trust:lifecycle` passed (33 lifecycle tests and 48 structural/performance tests; four opt-in timing/profile cases skipped). `trust:native` passed, including reproducibility of 18 distributed text files.
- Studio documentation browser checks, visual safeguards, built smoke, agent verification, and text source/production browser checks passed. The website check also passed, including all new executable chart minimal examples, desktop/mobile layout and no-JavaScript documentation navigation.
- Final aggregate `corepack pnpm@11.21.0 trust` was run and **did not pass**: the shared, unrelated `docs/superpowers/specs/2026-10-06-auxiliary-outputs-design.md` lacks the required historical-status banner. `lint:format` separately reports formatting in that same draft. The draft was preserved. The remaining stages were executed independently as described above; this is not presented as a green aggregate gate.
- The documentation verifier completed chart export/link/source checks, 280 parsed snippets and 96 compiler-checked API programs before failing the unrelated historical-banner assertion. Public JSDoc passed separately: 48 entries, 1133 declarations, 2478 members, 5621 resolved links.
- All twelve exact Studio tour URLs were loaded again on the final local server with no runtime errors. Compact alternate states were visually inspected. `git diff --check` is clean.

Transient local command logs: `/tmp/pibbl-chart-final-trust2.log`,
`/tmp/pibbl-chart-remaining-gates.log`, `/tmp/pibbl-chart-browser-resume.log`,
`/tmp/pibbl-chart-final-viz-source2.log`, and `/tmp/pibbl-chart-final-viz-built2.log`.
The commands and results above remain the durable evidence if those temporary logs
are removed.

## Shared checkout

No commit, merge, push or publication was performed by this task. The shared
checkout advanced independently from `f724a56e` to `c321a83c` (Brick Climb docs).
Unrelated alpha-release/trust-workflow changes and an auxiliary-output design
file were preserved. All chart changes remain reviewable in the working tree.

Final evidence recorded at 18:56 UTC on 2026-10-06. No visual baseline was changed.
