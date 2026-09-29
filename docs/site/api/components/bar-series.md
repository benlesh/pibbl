---
id: api-component-bar-series
title: BarSeries
summary: Composes signed value bars from named band and linear scales.
kind: api
slug: bar-series
apiCategory: component
symbols:
  [
    BarSeries,
    BarSeriesProps,
    BarSeriesStyle,
    BarCategoryAccessor,
    BarThresholdFill,
  ]
---

# BarSeries

Import from `@crc/viz`. This feedback slice supports vertical value bars:
`data`, `x` (category key/accessor), `y` (numeric key/accessor), `xScale` (band),
and `yScale` (linear). `orientation` may be `"vertical"` or omitted.
`baseline` is a signal-capable finite domain value, defaulting to zero. Linear
mapping extrapolates; use core Clip when clipping to a plot is desired.

Missing categories, unknown categories, null/undefined/nonfinite values, or rows
excluded by `defined` are skipped. Zero-length bars paint and target nothing.
Negative values normalize their two mapped endpoints into rectangle geometry.
Data accepts a signal; accessor reads belong to the receiving component.

`BarSeriesStyle` accepts whole and shallow field signals: `bandwidth` (default
`"auto"`, otherwise finite nonnegative local pixels centered in the band), `fill`
(default `#2563eb`), `stroke`, `strokeWidth` (1), `opacity` (1), and `cursor`.

Each row renders an ordinary core Rectangle in source order. Series handlers
bubble through their parent Group. Hit geometry is ordinary rectangle paint
geometry, including stroke; padding and omitted rows do not create targets.
Coordinates remain root-logical. There is no datum-enriched event: inspect via
`useScale(id, "band")`, data, and ordinary events. Per-row nodes have ordinary
component cost; this slice makes no large-data batching guarantee.

One future BarSeries will also support horizontal and ranged bars. Grouping will
compose nested band scales. Those props and nested bandwidth ranges are not yet
implemented; no separate horizontal/range/grouped series is introduced.

## Fill by value thresholds

A single series can color regions of each bar by value-scale coordinates:

```tsx
style={{
  fill: {
    type: "threshold",
    thresholds: [0, 300_000],
    colors: ["#c36638", "#167b70", "#c43c39"],
  },
}}
```

`BarThresholdFill` requires finite, strictly increasing thresholds and exactly
one more CSS color than thresholds. Below the first threshold uses the first
color; each threshold begins the next interval. Empty thresholds with one color
are valid. Colors are sharp regions, not interpolated gradients or whole-bar
classifications. A bar crossing multiple intervals receives each corresponding
color. Thresholds outside the bar do not extend it. Baseline and reversed value
scales preserve the same domain-based coloring.

The complete fill descriptor can be a signal, as can the whole style. Nested
threshold/color arrays contain plain values; replace the descriptor to update.
Stroke, opacity, and hit geometry remain those of one complete rectangle; color
boundaries add no borders or targets. Standard solid, gradient, and pattern fills
continue to work.
