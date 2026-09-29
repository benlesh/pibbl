---
id: api-component-plot-series
title: PlotSeries
summary: Positions custom keyed CRC subtrees at mapped data points.
kind: api
slug: plot-series
apiCategory: component
symbols: [PlotSeries, PlotSeriesProps, PlotKeyAccessor]
---

# PlotSeries

Import from `@crc/viz`. Supply `data`, numeric `x`/`y` accessors, `xScale`,
`yScale`, and `render(datum,index,data)`. The callback returns CRC nodes around
local `(0,0)` at the mapped point. Invalid coordinates and `defined=false` skip
rows. Custom elements keep ordinary styles, targets, and event handlers.

Use `keyBy="id"` or a key accessor for identity across reorder. Without keyBy,
original source indices are keys. Removing or invalidating a row unmounts it;
returning null retains the row wrapper. Keys normalize as CRC string/number keys.

The render callback constructs nodes; hooks belong in returned components.
Its explicit signal reads belong to the row receiver. Series handler props are
structural propagation listeners, with no independent hit geometry. Apply
`pointerEvents`, cursor, and styles to returned elements.

Marks inherit the plot allocation and are translated without resizing or
centering. Percentage lengths retain that allocation until an inner container
changes it. Each row costs its normal component subtree; use PointSeries for
large dot batches, optionally overlaid with a few custom PlotSeries annotations.
