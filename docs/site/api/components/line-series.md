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
    LineCurve,
  ]
---

# LineSeries

Import `LineSeries` and its types from `@crc/core/viz`. `LineSeriesProps<D>` requires
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
currently supports only `"linear"` (the default).

`LineSeriesStyle` is one static style across every run, with signal-valued whole
style/direct fields: `stroke` (default `#2563eb`), `strokeWidth` (2), `opacity` (1),
`cursor`, and `lineInteractionWidth` (defaults to strokeWidth). Widths must be
finite and nonnegative; opacity is between 0 and 1. No per-datum style callback,
segment styling, fill, or area is implemented.

One core `Path` owns the complete batch's paint and stroke hit geometry. Ordinary
core event handlers and `pointerEvents` work on that target; gaps remain gaps for
hit testing. There is no nearest-point event enrichment. Applications can compose
inspection or brushing with [`useScale`](#/api/hooks/use-scale) and core targets.
Wrap the series in a core `Clip` for clipping; scales do not clip automatically.
