---
id: api-component-interval-band-series
title: IntervalBandSeries
summary: Fill matching observed lower and upper bounds while preserving missing intervals.
kind: api
slug: interval-band-series
apiCategory: component
symbols: [IntervalBandSeries, IntervalBandSeriesProps]
---

# IntervalBandSeries

Import from `@pibbl/core/viz`.
`IntervalBandSeries<D>(props: IntervalBandSeriesProps<D>): PibblNode` fills between
two data-derived bounds. Unlike ReferenceBand, the bounds may change at every
observation. It does not invent a midpoint, aggregate data, or infer uncertainty.

Required inputs: `data`, `x`, `lower`, `upper`, `xScale`, and `yScale`. Data accepts
a readonly array or signal. Each accessor is a numeric field key or callback
`(datum, index, data) => number | null | undefined`. Both named scales must be
continuous: linear, UTC, log, or symlog. `defined?` runs before accessors. Missing,
nonfinite, or excluded coordinates split runs; at least two matching observations
are needed to draw. Authored order is preserved. Each polygon follows upper
bounds forward and lower bounds backward. Equal bounds produce zero area;
finite `lower > upper` throws RangeError identifying the row rather than silently
swapping their meaning. Invalid log coordinates also throw.

Presentation reuses `AreaSeriesStyle`: fill defaults to `#2563eb`, opacity to
`0.2`, and cursor is optional. Data, whole style, and its direct fields accept
signals; accessors track signal reads normally. Replace arrays to update them.
Opacity must be finite in [0, 1]. Invalid data/paint/style throws TypeError;
invalid opacity or scale mapping throws RangeError. Scale lookup failures follow
normal scale contracts. Unmount/failure cleanup uses the existing runtime.

One ordinary Path owns the complete batch and its filled event geometry. Use
`pointerEvents="none"` when decorative, and inspect the original observations
separately. Core transforms and explicit Clip apply; no layout, clipping,
margins, or scheduler is added. Compose LineSeries for either boundary.
Coordinates are connected by straight segments; these are interpolated edges,
not extra measurements. Unordered x values can self-intersect under Canvas's
nonzero fill rule; no sorting is hidden.

The [daily temperature example](#/examples/composition/viz-interval-temperature)
uses published NOAA daily minimum and maximum observations. The range describes
a day's temperature extremes, not a confidence or prediction interval.

Optional `curve` accepts the [named step or monotone definitions](#/api/functions/series-curves);
omission and `"linear"` retain straight segments.
