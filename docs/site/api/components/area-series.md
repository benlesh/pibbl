---
id: api-component-area-series
title: AreaSeries
summary: Fill observed runs to an explicit data-space baseline without bridging gaps.
kind: api
slug: area-series
apiCategory: component
symbols: [AreaSeries, AreaSeriesProps, AreaSeriesStyle]
---

# AreaSeries

Import from `@pibbl/core/viz`. `AreaSeries<D>(props: AreaSeriesProps<D>): PibblNode`
adds scale-derived closed geometry to ordinary Canvas fill. It owns one batched
core Path. Compose LineSeries for the observed outline; layout, clipping,
annotations, and inspection stay application-owned.

Required inputs are `data`, `x`, `y`, `xScale`, `yScale`, and `baseline`.
Data is a readonly array or signal of an array. Accessors follow
[LineSeries](#/api/components/line-series): a numeric field key or callback
`(datum, index, data) => number | null | undefined`. Both named scales must be
continuous (linear, UTC, log, or symlog). The finite numeric baseline is required
and maps through the y scale; log baselines must be positive. No implicit zero,
clamping, sorting, aggregation, or clipping occurs.

`defined?` runs before accessors. Excluded, missing, and nonfinite coordinates
split runs. Empty and isolated single-point runs draw no area. A run follows
observations in authored order, then closes from its last x to the baseline and
back to its first x. Duplicate x values produce vertical segments; baseline
crossings and reversed domains/ranges retain that geometry. Self-intersections
use Canvas's nonzero fill rule. These are geometric fills, not integrals or
additional observations. Query the original observations for inspection.

`baseline`, data, whole style, and direct style fields accept signals. Reads in
accessors track the component; replace arrays to update. No subscriptions or
resources survive removal/disposal. `style.fill` defaults to `#2563eb`,
`style.opacity` to `0.2`, and `style.cursor` is optional. Opacity must be finite
between 0 and 1; fill uses core paint values. No stroke or per-row styling is
accepted. Invalid arrays/styles throw TypeError; invalid baseline/opacity or
scale mapping throws RangeError; unknown/mismatched scales follow scale errors.

Normal core event props and pointer participation apply to the whole filled
Path. It participates by default; use `pointerEvents="none"` for decorative fill
under an inspection target. Gaps do not acquire filled hit geometry. Coordinates
are local logical pixels after mapping; core transforms and explicit Clip apply
normally. No margins or minimum layout size are allocated by the series.

Try [the NOAA area example](#/examples/composition/viz-area-basics): change the
reference baseline, deliberately omit June, and inspect with touch or keyboard.
The fill is distance above that reference, not cumulative emissions.

Optional `curve` accepts the [named step or monotone definitions](#/api/functions/series-curves);
omission and `"linear"` retain straight segments.
