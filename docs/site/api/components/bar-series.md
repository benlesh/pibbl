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
    BarStyleResolver,
    BarCategoryAccessor,
    BarThresholdFill,
  ]
---

# BarSeries

Import from `@crc/viz`. This component supports vertical value bars:
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

Horizontal and ranged bars remain future extensions of the same BarSeries.

## Grouped bars

Supply `group` (a category key/accessor) and `groupScale` together. The inner
band scale defines group order and spacing within each outer category:

```tsx
import { BarSeries, Scale } from "@crc/viz";
const rows = [
  { month: "Jan", team: "East", sales: 72, category: "Jan", value: 320_000 },
  { month: "Jan", team: "West", sales: 55, category: "Feb", value: -40_000 },
];
const grouped = (
  <Scale id="month" type="band" domain={["Jan", "Feb"]} range="width">
    <Scale
      id="team"
      type="band"
      domain={["East", "West"]}
      range={{ bandwidthOf: "month" }}
      paddingInner={0.15}
    >
      <Scale id="sales" type="linear" domain={[0, 100]} range="height" reverse>
        <BarSeries
          data={rows}
          x="month"
          y="sales"
          group="team"
          xScale="month"
          yScale="sales"
          groupScale="team"
          style={(row) => ({ fill: row.team === "East" ? "teal" : "orange" })}
        />
      </Scale>
    </Scale>
  </Scale>
);
void grouped;
```

Group identity follows band category identity. Missing or unknown groups skip
their rows; other groups retain their slots. Reordering the inner domain moves
groups consistently across categories. Empty or collapsed bands paint no bars.
Offsets add the outer category start to the inner group start. Auto bandwidth
uses the inner scale; explicit bandwidth centers within that group slot and may
overlap neighboring slots. Duplicate category/group rows paint in source order.

`BarStyleResolver<D>` receives `(datum, index, data)` for each eligible row.
Return a plain `BarSeriesStyle`, including threshold fills if desired. Read
signals explicitly inside the callback; returned field signals are rejected.
Callbacks are synchronous and cannot call hooks. A callback replaces the shared
style form rather than merging with it. Each rectangle retains its own cursor,
paint, and normal event geometry.

Try [Grouped bars](#/examples/composition/viz-grouped-bars) with two or three
years, group reordering, resizing, and pointer inspection.

## Fill by value thresholds

A single series can color regions of each bar by value-scale coordinates:

```tsx
const thresholdBars = (
  <BarSeries
    data={rows}
    x="category"
    y="value"
    xScale="categories"
    yScale="values"
    style={{
      fill: {
        type: "threshold",
        thresholds: [0, 300_000],
        colors: ["#c36638", "#167b70", "#c43c39"],
      },
    }}
  />
);
void thresholdBars;
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
