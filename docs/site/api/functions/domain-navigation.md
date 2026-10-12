---
id: api-function-domain-navigation
title: Continuous domain navigation
summary: Pure bounded pan and anchored zoom through an existing continuous mapping.
kind: api
slug: domain-navigation
apiCategory: function
symbols:
  [
    panDomain,
    zoomDomain,
    DomainNavigationConstraints,
    PanDomainOptions,
    ZoomDomainOptions,
  ]
---

# Continuous domain navigation

Import from `@pibbl/core/viz`:

```ts
import type {
  ResolvedContinuousScale,
  LinearDomain,
  PanDomainOptions,
  ZoomDomainOptions,
} from "@pibbl/core/viz";

declare function panDomain(
  scale: ResolvedContinuousScale,
  options: PanDomainOptions,
): LinearDomain;
declare function zoomDomain(
  scale: ResolvedContinuousScale,
  options: ZoomDomainOptions,
): LinearDomain;
```

`PanDomainOptions` extends `DomainNavigationConstraints` with required
`rangeDelta: number`. `ZoomDomainOptions` extends the same constraints with
required `rangeAnchor: number` and `factor: number`. All settings live directly
in the second argument: `{ rangeDelta, bounds, minimumSpanRatio? }` or
`{ rangeAnchor, factor, bounds, minimumSpanRatio? }`. The old positional
signatures are not supported.

Both return a frozen two-number domain pair and own no signals, layout, events,
resources, or scheduling. Read the current mapping from its dedicated scale hook,
call the operation in an event handler, and write the pair to an application-owned
domain signal. The algorithms work through map/invert for linear, UTC, log, and
symlog scales, including reversed ranges and descending domains. Categorical
scales are not continuous mappings and are not accepted.

`options.bounds` is a required finite two-endpoint hard domain extent, in
either order. Values must be valid for the chosen scale (positive for log, safe integer
milliseconds for UTC).
`minimumSpanRatio` defaults to `0.01`, must be greater than zero and at most one,
and measures the minimum fraction of the **mapped hard bounds**. On log scales,
this is a logarithmic extent, not a minimum arithmetic difference.

The helpers impose no unit on numeric ranges. `rangeDelta` is a displacement in
range units; `rangeAnchor` is a position in those same coordinates. A range may
represent logical pixels, normalized coordinates, or another numeric system.
Positive `rangeDelta` shifts mapped values toward increasing range coordinates
and moves the viewing domain oppositely. `factor > 1` magnifies; a factor between
zero and one zooms out. The anchor's data value stays stationary unless bounds or
the minimum span limit the request. At constraints the window shifts/clamps;
a too-small window expands around its center. Bounds can therefore move the
anchor. UTC results round to integer milliseconds, with corresponding sub-ms
anchor error. No caller data is sorted, aggregated, or changed.

Nonfinite values, nonpositive factors, invalid minimum ratios, collapsed bounds,
collapsed current domain/range, nonfinite mapped arithmetic, and a result that
collapses at numeric precision throw RangeError (or the mapping's validation
error). Inputs are ordinary values: resolve signals explicitly. Wheel delta
normalization, touch behavior, reset policy, and gesture cancellation belong to
the application, as shown in the [domain exploration example](#/examples/composition/viz-domain-exploration).
