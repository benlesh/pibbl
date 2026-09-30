---
id: api-component-pie-layout
title: PieLayout, PieSlice, and PieLabel
summary: Coordinate radial geometry and label layout while composing ordinary CRC marks.
kind: api
slug: pie-layout
apiCategory: component
symbols:
  [
    PieLayout,
    PieSlice,
    PieLabel,
    PieLayoutProps,
    PieLayoutStyle,
    PieLayoutSlice,
    PieLabelPlacement,
    PieLabelLayout,
    PieSliceProps,
    PieSliceStyle,
    PieLabelProps,
    PieLabelStyle,
  ]
---

# PieLayout, PieSlice, and PieLabel

`PieLayout` calculates geometry and label placements before rendering its function
children once per source row. Import these components from `@crc/viz`.

Pass `data`, `value`, optional `keyBy`, and a `label(slice)` callback returning
single-line text. Style accepts numeric `cx`, `cy`, `radius`, `labelFont`, and
`labelGap`; defaults use the current allocation. `bounds` defaults to that local
allocation. Bounds constrain labels, not paint; compose core Clip if needed.

`placement` is `outside` (default), `inside`, or `auto`. Inside labels must fit
in the sector and bounds; otherwise they are hidden. Auto moves non-fitting
labels outside. Outside labels occupy separate left/right lanes, stay outside
the whole disk, and preserve vertical anchor order. Leaders fan out immediately
from slice midpoints, ending with a short horizontal segment beside the text.
Each half packs labels away from the equator, respecting the circle tangent so
leaders do not cross the pie. Labels that cannot fit are omitted deterministically. No font
shrinking, sorting of data, or aggregation is implicit.

Each callback receives a `PieLayoutSlice`: original `PieSliceGeometry` fields,
center/radius, and optional `label`. Labels expose `status: "placed"` with their
box, baseline, and leader points, or `status: "hidden"` with reason `empty`,
`inside-fit`, or `space`. Applications can provide a legend or other fallback.

`PieSlice` takes `slice`, normal CRC events/focus props, paint style, and optional
children. `PieLabel` takes the same slice and renders its coordinated label and
leader. Label font belongs to the chart's measurement inputs; its paint style
accepts `fill`, `leaderStroke`, and `leaderWidth`. Labels are decorative by
default. Set `pointerEvents="auto"` and provide event handlers to make a label
box selectable. Wedge hit geometry never expands to include its label.

Data and chart style inputs accept core signals. Use immutable data updates.
Keep accessors and label callbacks stable to reuse computed geometry and layout;
reads inside those callbacks participate in core signal tracking. Paint-only
updates reuse the resolved layout. The Canvas root still repaints, including
ordinary wedge paths; no separate renderer, frame loop, or retained paint cache
is introduced. Callbacks cannot call hooks; return components for hooks.

The first slice supports solid pies and single-line labels. Font changes must
be supplied as inputs; load custom fonts before mounting. Donuts, multiline
text, arbitrary custom label measurement, and automatic legend generation are
not part of this contract.
