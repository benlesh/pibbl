---
id: api-component-line-series
title: LineSeries
summary: Draws ordered data as one batched line path with missing-data gaps.
kind: api
slug: line-series
apiCategory: component
symbols:
  [
    LineSeries,
    LineSeriesProps,
    LineSeriesStyle,
    LineCoordinate,
    LineAccessor,
    SeriesCoordinate,
    SeriesAccessor,
    LineCurve,
  ]
---

# LineSeries

Import `LineSeries` and its types from `@pibbl/core/viz`. `LineSeriesProps<D>` requires
`data`, `x`, `y`, `xScale`, and `yScale`. Data is a readonly array or a core signal
of an array. It is not a thunk. Replace arrays to notify consumers; mutation alone
is not reactive.

`LineAccessor<D>` accepts a property key whose value is a `LineCoordinate`, or
`(datum, index, data) => LineCoordinate`. A coordinate is a number, null, or
undefined. Function accessors run during component evaluation; signal reads inside
them belong to the series. Row fields are not recursively unwrapped.

`defined(datum, index, data)` runs before coordinate accessors. False, missing,
NaN, or infinite coordinates split the line into separate runs. Isolated points
paint nothing. Input order is preserved; points are never sorted. `LineCurve`
supports `"linear"` (the default) or a named immutable
[step or monotone definition](#/api/functions/series-curves).

`LineSeriesStyle` is one static style across every run, with signal-valued whole
style/direct fields: `stroke` (default `#2563eb`), `strokeWidth` (2), `opacity` (1),
`cursor`, and `lineInteractionWidth` (defaults to strokeWidth). Widths must be
finite and nonnegative; opacity is between 0 and 1. No per-datum style callback,
segment styling or fill is implemented here; compose AreaSeries for filled geometry.

One core `Path` owns the complete batch's paint and stroke hit geometry. Ordinary
core event handlers and `pointerEvents` work on that target; gaps remain gaps for
hit testing. There is no nearest-point event enrichment. Applications can compose
inspection or brushing with [`useLinearScale`](#/api/hooks/use-scale) and core targets.
Wrap the series in a core `Clip` for clipping; scales do not clip automatically.

## Categorical positions

LineSeries, PointSeries, and PlotSeries accept `SeriesAccessor<D>` for x/y. It
extracts `SeriesCoordinate = number | string | null | undefined`. PointScale maps
string and finite numeric categories without coercion: `1` and `"1"` remain
different identities. Unknown categories throw RangeError. Continuous scales
require numbers and reject strings. Null, undefined, and nonfinite numbers create
gaps (or omit isolated marks). BarScale is not a point-position scale.

Source order determines line traversal and is never sorted. PointScale reversal
changes placement without changing datum identity. Domain/data signals and nested
scale lookup retain ordinary reactive ownership. Application code supplies
category inspection through the dedicated `usePointScale` mapping/inversion;
numeric query helpers and `PointAccessor` remain numeric contracts.

`LineAccessor` remains the numeric accessor for area/band bounds and numeric
operations. Neither accessor type can statically prove that an arbitrary scale ID
refers to the matching provider; runtime validation enforces that relationship.
