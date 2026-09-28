---
id: api-component-axis
title: Axis
summary: Draws a bottom or left axis for a named linear scale.
kind: api
slug: axis
apiCategory: component
symbols: [Axis, AxisProps, AxisStyle]
---

# Axis

Import `Axis` from `@crc/viz`. `AxisProps` requires `scale: ScaleId` and
`position: "bottom" | "left"`. It accepts signal-valued `tickCount` (default 5),
`tickFormat(value, index)` returning a string, and an optional signal-valued style.

The bottom baseline lies at the scale frame's height; the left baseline lies at
x = 0. Endpoints follow the scale range. Ticks extend outward by 6 pixels, with
labels another 4 pixels away. Reversing the scale changes tick positions, not the
frame edge. Axis does not reserve layout space: allocate label gutters yourself.

`AxisStyle` supports `stroke` and `fill` (both default `#64748b`), `strokeWidth`
(default 1), `font` (default `12px sans-serif`), and `opacity` (default 1).
Whole styles and direct fields accept shared core signals. Width must be finite
and nonnegative; opacity must be between 0 and 1. Styles remain local.

Default labels use six significant digits with trailing zeros removed. Formatting
receives original domain values in domain order. Axis output is decorative and
uses `pointerEvents="none"`. Tick generation is evenly spaced, not calendar-aware.
