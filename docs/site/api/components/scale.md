---
id: api-component-scale
title: Scale
summary: Provides a named reactive linear, UTC, or band scale in its local allocation.
kind: api
slug: scale
apiCategory: component
symbols:
  [
    Scale,
    ScaleId,
    LinearDomain,
    NumericDomain,
    UtcDomain,
    UtcScaleProps,
    ResolvedUtcScale,
    ResolvedContinuousScale,
    BandCategory,
    BandDomain,
    BandScaleProps,
    BandScaleRange,
    ResolvedBandScale,
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

Import `Scale` and its types from `@crc/viz`. Use the core JSX runtime.

`ScaleProps` is `LinearScaleProps | UtcScaleProps | BandScaleProps`. Linear scales require `id`, `type: "linear"`,
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

`ResolvedScale` is `ResolvedContinuousScale | ResolvedBandScale`;
`ResolvedContinuousScale` is `ResolvedLinearScale | ResolvedUtcScale`. The linear snapshot has:

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
Browser-local time, logarithmic, and auto-domain scales are deferred.

## Band scales

Use `type="band"` with an explicit ordered `BandDomain` of strings or finite
numbers (`BandCategory`). Identity uses SameValueZero: `1` and `"1"` are distinct;
`-0` and `0` are the same category. Duplicate entries reject. Input order is
preserved, and empty domains are valid. Unknown categories map to `undefined`.

`paddingInner` defaults to 0 and is a fraction of the step in `[0, 1]`.
`paddingOuter` defaults to 0 and is a finite nonnegative number of steps per side.
For n categories, step = extent / max(1, n - paddingInner + 2 * paddingOuter).
Bandwidth = step * (1 - paddingInner); remaining space is centered. Empty domains
have zero step/bandwidth. Collapsed ranges have zero bandwidth. Reverse changes
category placement, while each `map(category)` remains the lower pixel edge.

Read `useScale(id, "band").get()` for the immutable `ResolvedBandScale`: `domain`,
`range`, `frame`, `step`, `bandwidth`, and `map(category)`. There is no numeric
inversion or tick method. Labels can use `map(category) + bandwidth / 2`.
Domain, padding, reverse, and range accept signals and follow local allocation.
For nested bands, `BandScaleRange` additionally accepts
`{ bandwidthOf: ancestorId }`. It resolves to `[0, ancestor.bandwidth]`,
reacting to ancestor domain, padding, and allocation changes. The reference
must identify a visible ancestor band scale in the same rendering instance.
Nearest matching scope wins, as with `useScale`. Missing references and wrong
scale families reject. Ancestor-only lookup prevents circular references.
Zero ancestor bandwidth produces a collapsed range. The inner frame remains
the layout allocation; only its range uses the ancestor bandwidth. Linear
scales do not accept this range form.

## UTC scales

Use `type="utc"` with `UtcScaleProps` to map numeric epoch milliseconds.
`NumericDomain` is a readonly numeric pair; `UtcDomain` uses that shape with
UTC validation. Endpoints must be distinct safe integers within the inclusive
Date range, ±8,640,000,000,000,000 milliseconds; descending domains are valid.
Mapping and inversion remain numeric and do not clamp. Collapsed ranges cannot
be inverted. There is no Date-valued coordinate API.

Read `useScale(id, "utc")` for a `ResolvedUtcScale`, or
`useScale(id, "continuous")` for either numeric family. UTC generated ticks
include endpoints and bounded UTC calendar boundaries, with at most 100 values.
`formatTick(value)` returns a full UTC ISO timestamp; override Axis `tickFormat`
for shorter labels. Formatter state never depends on a prior tick call.

Use the explicit [domain helpers](#/api/functions/domain-helpers) for numeric
extent and UTC domain rounding. Scale never extends its domain automatically.
