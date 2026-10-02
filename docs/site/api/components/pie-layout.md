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
children once per source row. Import these components from `@crc/core/viz`.

Pass `data`, `value`, optional `keyBy`, and a `label(slice)` callback returning
single-line text. Style accepts numeric `cx`, `cy`, `radius`, `innerRadius`, and `labelGap`,
plus a Canvas font string `labelFont`; defaults use the current allocation. `bounds` defaults to that local
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
center, outer `radius`, `innerRadius`, and optional `label`. Labels expose `status: "placed"` with their
box, baseline, and leader points, or `status: "hidden"` with reason `empty`,
`inside-fit`, or `space`. Applications can provide a legend or other fallback.

`PieSlice` takes `slice`, normal CRC events/focus props, paint style, and optional
children. `PieLabel` takes the same slice and renders its coordinated label and
leader. Label font belongs to the chart's measurement inputs; its paint style
accepts `fill`, `leaderStroke`, and `leaderWidth`. Labels are decorative by
default. Set `pointerEvents="auto"` and provide event handlers to make a label
box selectable. Slice hit geometry never expands to include its label.

## Donuts and label containment

`innerRadius` defaults to zero. For a nonzero radius require finite
`0 <= innerRadius < radius`; a zero radius permits only a zero inner radius.
`PieSlice` paints and targets the same annular path. Its hole lets input reach
underlying content, and the inner edge participates in ordinary stroke geometry.

The inside candidate lies on the angular bisector at
`innerRadius + 0.65 * (radius - innerRadius)`. The complete measured label box
must fit the bounds, outer disk and conservative angular region, and its closest
point to the center must remain outside the hole. Testing corners against the
hole alone is insufficient. Tangency is allowed. The angular region uses at
most a half-disk, so a wide slice can omit a label that a more expensive placement
search might fit. No search, shrinking, clipping or movement into the hole is
performed. Failed `inside` placement reports `inside-fit`; `auto` tries the
outside lanes and reports `space` if those fail. Empty text or geometry reports
`empty`. Outside leaders remain anchored to the outer radius.

## Updates, caching and ownership

Data and chart style inputs accept core signals. By default, each PieLayout
component evaluation reevaluates data/value/key/label callbacks; their stable
identities do not prove their results unchanged. Plain mutation alone does not
schedule CRC work. Signal reads inside callbacks are tracked dynamically.
Callbacks cannot call hooks; return components for hooks.

Optional `revision` accepts a signal-capable nonnegative safe integer and opts
into cached preprocessing. Change it whenever mutable data or nonreactive
callback dependencies change, including captured variables, external lookup
tables or loaded font metrics. Setting a data signal to the same array can be
equality-suppressed; an independently changed revision signal schedules work.
Data/accessor replacement and tracked signal changes also invalidate relevant
work. Layout additionally depends on center/radii, bounds, font, gap, placement
and label callback. Stable revision plus unchanged dependencies allows paint-only
selection changes to reuse geometry and measurements.

```tsx
import { signal } from "@crc/core";
import { PieLayout, PieSlice, PieLabel, type PieSliceGeometry } from "@crc/core/viz";

const rows = [
  { amount: 2, name: "North" },
  { amount: 3, name: "South" },
];
const label = (slice: PieSliceGeometry<(typeof rows)[number]>) =>
  slice.datum.name;
const revision = signal(0);
<PieLayout
  data={rows}
  value="amount"
  revision={revision}
  label={label}
  style={{ radius: 100, innerRadius: 55 }}
>
  {(slice) => (
    <PieSlice slice={slice}>
      <PieLabel slice={slice} />
    </PieSlice>
  )}
</PieLayout>;
// After an in-place edit outside render:
revision.update((value) => value + 1);
```

Geometry and label work is mount-owned and released on removal/disposal.
A rebuild never publishes partial layout. Slice geometry is O(n); inside checks
are O(1) per label, with outside packing O(n log n) sorting plus linear sweeps.
The root still repaints ordinary paths. There is no separate renderer, frame
loop, global cache or retained paint cache.

The label renderer supports single-line text. Load custom fonts before mounting
or change revision when their metrics change. Multiline/custom label content
and automatic legend generation remain separate capabilities.
