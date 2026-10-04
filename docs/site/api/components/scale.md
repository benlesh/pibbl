---
id: api-component-scale
title: Scale
summary: Provides a named reactive linear scale in its local allocation.
kind: api
slug: scale
apiCategory: component
symbols:
  [
    Scale,
    ScaleId,
    LinearDomain,
    ScaleRange,
    ScaleLayoutStyle,
    LinearScaleProps,
    ScaleProps,
    ResolvedLinearScale,
    ResolvedScale,
  ]
keywords: [visualization, scale, domain, range, signals]
---

# Scale

Import `Scale` and its types from `@crc/core/viz`. Use the core JSX runtime.

`ScaleProps` currently aliases `LinearScaleProps`: required `id`, `type: "linear"`,
`domain`, and `range`; optional `reverse`, `style`, and `children`. `ScaleId` is a
nonempty string or a symbol. Nested providers shadow the nearest matching ID;
siblings and independent roots cannot see each other's providers.

`LinearDomain` contains two finite, unequal numbers, ascending or descending.
`ScaleRange` is a finite numeric pair, `"width"`, or `"height"`. Allocation ranges
start at zero and end at the local allocated extent. `reverse` swaps endpoints;
use it with height to make larger values appear higher. Domain, range, and reverse
accept core `SignalValue` inputs. Signal resolution is shallow.

`ScaleLayoutStyle` contains width, height, and core layout-item styles. Whole
styles and direct fields may be core signals. Scale does not paint, transform,
reserve gutters, or create a global chart rectangle. Its children receive the
same allocation; put gutters and placement in ordinary core layout.

`ResolvedScale` currently aliases `ResolvedLinearScale`, an immutable snapshot:

- `type`, `domain`, and `range` describe the mapping.
- `frame` has local x/y zero and the allocation's width/height.
- `map(value)` maps finite values with linear extrapolation, without clamping.
- `invert(pixel)` reverses that mapping. A zero-span range maps to its endpoint
  but cannot be inverted.
- `ticks(count = 5)` returns evenly spaced values including both domain ends.
  Count must be an integer from 2 through 100. These are not calendar or nice ticks.

Use [`useScale`](#/api/hooks/use-scale) to read the scale signal. Definitions are
lazy; malformed resolved inputs throw on evaluation. Nonfinite arithmetic results
also throw. Updating a signal or allocation refreshes the existing scale signal;
equivalent domain/range/frame values suppress downstream invalidation.

A scale provider and consumer must share one rendering instance. Put the complete
scale subtree inside a `Layer`; lookup across a Layer boundary is unsupported.
Time, logarithmic, categorical, band, and auto-domain scales are deferred.
