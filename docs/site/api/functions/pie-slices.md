---
id: api-function-pie-slices
title: pieSlices
summary: Calculate source-ordered slice angles independently of rendering.
kind: api
slug: pie-slices
apiCategory: function
symbols: [pieSlices, PieSliceGeometry, PieOptions]
---

# pieSlices

Import `pieSlices` from `@pibbl/core/viz`. Call `pieSlices(data, { value, keyBy? })`.
`value` is a numeric property key or `(datum, index, data)` accessor; `keyBy`
uses the same property/function convention as `PlotSeries`.

Returns a frozen array of frozen `PieSliceGeometry` records with `datum`, source `index`,
string `key`, `value`, `fraction`, `startAngle`, and `endAngle`. Datum references
are preserved, not frozen or copied. No sorting or input mutation occurs.

Values must be finite and nonnegative. Null and undefined become zero; other
invalid values and an overflowing total throw. Zero/missing rows remain in the
result with zero fraction and equal angles. Empty input returns an empty array;
an all-zero dataset has no painted sectors. A zero fraction does not mean an
equal share.

Angles use Canvas radians, clockwise from −π/2 (12 o'clock), covering one full
turn. Feed them directly to core `Wedge` style. Its exact filled-sector and
optional stroke geometry supplies normal Pibbl events, transforms, and clipping.
Decorative labels should set `pointerEvents="none"`. Shared edges use ordinary
source paint order; there is no nearest-slice or chart-wide target.

Keys default to stringified source indices. Supply unique stable category IDs
for mutable data and use `slice.key` as the Pibbl element key. String and finite
number keys are accepted; duplicates after string conversion throw. Reordering
changes angles while preserving explicit keys; record objects are fresh on each
call.

The helper owns no rendering or reactive resources. Read data signals inside a
component or core computed and pass the resulting plain array. Compose `Wedge`,
custom labels, legends, and `HoverCard` with ordinary elements and handlers.
Angles are radius-independent, so custom annular `Path` geometry can reuse them;
core Wedge has no inner radius. Donut rendering, padding, sorting, and arbitrary
sweeps are outside this first slice.
