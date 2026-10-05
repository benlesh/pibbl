# @pibbl/core/viz

Official composable Canvas visualization for Pibbl, with no visualization runtime
dependency. Included in `@pibbl/core`, sharing its version and JSX runtime.

- `Scale`: nested ID-based linear scales driven by core signals and local layout.
- `useScale`: read the nearest scale as a readonly core signal.
- `Axis`: bottom and left ticks/labels in the local frame.
- `LineSeries`: one batched path with key/function accessors and missing-data gaps.
- `ScaleAdjust`: translate ordinary Pibbl children by scale coordinates.

There is no monolithic Chart component. Applications compose layout, gutters,
clipping, markers, legends, and interaction using normal Pibbl components/events.

See the [guide](../../../../../docs/site/learn/guides/data-visualization.md) and the
[interactive example](http://localhost:5173/#/examples/composition/viz-responsive-line).
Current scope is linear numeric scales and linear curves. Additional series,
calendar scales, curve families, and the example's mobile presentation are deferred.

## Points and hover inspection

`PointSeries` batches default circles with one union event target; `PlotSeries`
places keyed ordinary Pibbl subtrees through a required render callback. Use
`nearestPoint` / `nearestDomainValue` for pure resolved-scale scans, or `HoverData`
for function-based queries whose signal reads belong to the mounted receiver.

`defineSeries`, `closestPoint`, `closestX`, `interpolateX`, and
`linearInterpolation` compose recorded or estimated results across multiple
lines. `HoverCard` independently positions a declared padded card without covering
its protected anchor. These exports use the existing core JSX runtime and scale
scope; there is no additional renderer, interaction loop, or Chart registry.

`AnchoredLayout` arranges multiple keyed, declared boxes together in a row or
column, clear of every supplied anchor. It accepts arbitrary Pibbl content without
requiring chart scales or hover state. Use it when independent cards would overlap.

See the public data-visualization guide and Studio's Penguin measurements and
Hover comparisons examples for full wiring. Core responsive `style.when` rules work on returned Pibbl elements. Direct
conditional-style support for viz-owned styles remains a separate follow-up.
