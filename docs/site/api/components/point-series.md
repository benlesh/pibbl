---
id: api-component-point-series
title: PointSeries
summary: Draws batched circular marks with shared or per-datum paint.
kind: api
slug: point-series
apiCategory: component
symbols:
  [
    PointSeries,
    PointSeriesProps,
    PointSeriesStyle,
    PointStyleResolver,
    PointMarkStyle,
    PointAccessor,
  ]
---

# PointSeries

Import from `@crc/viz`. Supply `data`, `x`, `y`, `xScale`, and `yScale` as for
LineSeries. Invalid coordinates skip independent marks; `defined` runs first.
Data may be a signal. Arrays and nested row values are never implicitly unwrapped.

The default dot has radius 3 logical units and fill `#2563eb`. Style accepts
`radius`, `fill`, `stroke`, `strokeWidth` (default 1), `opacity` (default 1), and
`cursor`. Use `fill: ""` for stroke-only rings. Zero radius paints and targets
nothing; opacity zero keeps geometry. Widths/radii are finite and nonnegative.

A shared style supports shallow signals. Alternatively, `style(datum,index,data)`
returns plain PointMarkStyle values; explicit signal reads are supported, but
nested returned signals and per-datum cursors are not. Points paint fill then
stroke in source order, preserving translucent overlap. One logical target covers
the union of dots/rings, with normal CRC handlers and `pointerEvents`.

Use PlotSeries for custom CRC elements and nearestPoint for explicit inspection.
No implicit clipping, sorting, domain inference, or per-point focus is added.
