---
id: api-component-axis
title: Axis
summary: Draws categorical or numeric axes on any frame edge with bounded tick selection.
kind: api
slug: axis
apiCategory: component
symbols: [Axis, AxisProps, AxisStyle]
---

# Axis

Import `Axis` from `@crc/viz`. Supply `scale: ScaleId` and `position`:
`"bottom"`, `"left"`, `"top"`, or `"right"`. Linear and band scales are supported.
The bottom/right baseline uses the frame height/width; top/left uses zero.
Endpoints follow the scale range. Ticks extend outward by 6 pixels, with labels
another 4 pixels away. Reversing a scale changes mapping, not the frame edge.
Axis does not reserve layout space: allocate label gutters yourself.

## Tick selection

Supply either signal-capable `tickCount` or `tickValues`, never both.

`tickCount` defaults to 5 and must be an integer from 0 through 100. Zero emits
no ticks or labels; one selects the first domain endpoint/category. Linear
counts of two or more are evenly spaced and include endpoints. Band counts are
a maximum: empty domains emit none, singleton domains emit one for any positive
count, and larger selections use evenly rounded domain indices with both
endpoints included. Band ticks are centered in their bands. Selection preserves
domain order, including when the physical range is reversed.

`tickValues` is an explicit array of at most 100 numbers or strings. An empty
list emits no ticks or labels. Numeric scales require finite numbers within the
inclusive domain extent, including descending domains. Band values must be known
categories; numeric `1` and string `"1"` are distinct. Duplicates reject (`0` and
`-0` count as equal). Invalid values are never coerced, clamped or silently
removed. The complete list is validated before formatting or tick geometry
allocation. Caller order is preserved; ticks are not sorted or deduplicated.

`tickFormat(value: number | string, index: number)` returns a string and receives
the emitted value and its emitted-order index. Numeric default labels use six
significant digits with trailing zeros removed; strings are unchanged. Two
values may format to the same text. The baseline remains visible with no ticks.
Tick generation is not yet nice-domain or calendar-aware.

```tsx
import { Axis } from "@crc/viz";

<>
  <Axis scale="categories" position="left" tickValues={["North", "South"]} />
  <Axis
    scale="values"
    position="top"
    tickCount={5}
    tickFormat={(value) => (typeof value === "number" ? `${value}%` : value)}
  />
</>;
```

## Style and cost

`AxisStyle` supports `stroke` and `fill` (both default `#64748b`), `strokeWidth`
(default 1), `font` (default `12px sans-serif`), and `opacity` (default 1).
Whole styles and direct fields accept core signals. Width must be finite and
nonnegative; opacity must be between 0 and 1. Styles remain local.

Axis output is decorative and uses `pointerEvents="none"`. Work is O(k) for
k emitted ticks, bounded by 100 labels and one combined path. Generated band
selection does not copy or scan the full domain; scale construction owns domain
validation. There is no text-fit loop, retained cache or additional scheduler.
