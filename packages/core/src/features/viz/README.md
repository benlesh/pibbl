# @pibbl/core/viz

Official composable Canvas visualization for Pibbl, with no visualization runtime
dependency. Included in `@pibbl/core`, sharing its version and JSX runtime.

- `LinearScale`, `BarScale`, `UTCScale`, `LogScale`, `SymlogScale`, and `PointScale`: nested ID-based positional scales driven by core signals and local layout.
- Each provider has a dedicated hook (`useLinearScale`, `useBarScale`, `useUTCScale`, `useLogScale`, `useSymlogScale`, `usePointScale`) with a fixed readonly signal type.
- `Axis`: four-sided numeric/calendar/categorical ticks/labels in the local frame.
- `LineSeries`: one batched path with key/function accessors and missing-data gaps.
- `ScaleAdjust`: translate ordinary Pibbl children by scale coordinates.

There is no monolithic Chart component. Applications compose layout, gutters,
clipping, markers, legends, and interaction using normal Pibbl components/events.

See the [guide](../../../../../docs/site/learn/guides/data-visualization.md) and the
[interactive example](http://localhost:5173/#/examples/composition/viz-responsive-line).
UTC calendar scales and numeric domain helpers are available in the
[UTC reference](../../../../../docs/site/api/functions/utc-domains.md).
The UTC basics and climate examples show compact labels and phone layouts.
Local-calendar scales remain deferred. Line, area and interval marks support linear,
named step, and monotone-x curves.

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

## Marks, exploration and color

`AreaSeries` requires an explicit baseline; `IntervalBandSeries` pairs lower and
upper observations. Both preserve missing-data runs. Named `stepBefore`,
`stepAfter`, `stepMidpoint` and `monotoneX` definitions are shared by line, area
and interval marks. Existing Line/Point/Plot series accept PointScale categories
through `SeriesAccessor` without widening numeric query contracts.

`panDomain` and `zoomDomain` are pure bounded operations on resolved continuous
scales. Application signals/events own selection, pinning, brush drafts, capture,
zoom commands and layout; the learning examples show those recipes.

Dedicated sequential, diverging and threshold color providers/hooks expose fixed
readonly mappings, immutable stops or bands, and required authored hex palettes.
No generic scale selector, hidden aggregation, inversion or automatic legend is
introduced. See the [color contract](../../../../../docs/site/api/components/color-scales.md).
