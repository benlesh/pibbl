---
id: api-component-color-scales
title: Color scales
summary: Dedicated sequential, diverging, and threshold mappings with explicit colors.
kind: api
slug: color-scales
apiCategory: component
symbols:
  [
    SequentialColorScale,
    useSequentialColorScale,
    SequentialColorScaleProps,
    ResolvedSequentialColorScale,
    DivergingColorScale,
    useDivergingColorScale,
    DivergingColorScaleProps,
    ResolvedDivergingColorScale,
    ColorScaleStop,
    ThresholdColorScale,
    useThresholdColorScale,
    ThresholdColorBand,
    ThresholdColorScaleProps,
    ResolvedThresholdColorScale,
  ]
---

# Color scales

Import from `@pibbl/core/viz`. Each continuous provider takes `id`, `domain`, `colors`, and
optional `children`. Domain and colors accept ordinary values or signals.

- `SequentialColorScale`: two finite domain values and two colors.
  `useSequentialColorScale(id): Signal<ResolvedSequentialColorScale>`.
- `DivergingColorScale`: three finite domain values (endpoint, center, endpoint)
  and three colors. `useDivergingColorScale(id): Signal<ResolvedDivergingColorScale>`.

A resolved mapping exposes frozen `domain`, `colors`, `stops`, and
`map(value: number): string`. `ColorScaleStop` is `{value: number, color: string}`.
Use actual resolved stops and map results to compose annotations with core Text
and shapes. No inversion, generic scale hook, or automatic legend is provided.

Colors are required `#RRGGBB` strings (case-insensitive input); output is canonical
lowercase `#rrggbb`. Interpolation is linear per **encoded sRGB channel**, rounded
to the nearest integer, with exact authored endpoint and center colors. It is not
linear-light or perceptually uniform interpolation. There is no default palette;
choose endpoints that suit the data and provide labels or shapes in addition to
color when distinctions matter. Named CSS colors, alpha, gradients, and other
color spaces are deliberately outside this mapping contract.

Sequential domains may ascend or descend, preserving endpoint-color association.
If both domain values are equal, every finite input maps to the channel midpoint.
Diverging domains must be strictly increasing or strictly decreasing around the
authored center; no symmetry is inferred. A center input maps to the exact center
color. Both families clamp finite out-of-domain inputs to endpoint colors;
extrapolation is not supported. Nonfinite inputs reject rather than returning an
unknown color. Providers validate lazily when the resolved mapping is read.

Invalid counts, colors, domain values, or diverging order throw TypeError or
RangeError. IDs must be nonempty strings or symbols. Each dedicated hook resolves
the nearest matching ID and rejects a different color family, absent provider,
or crossing a Layer boundary. Color IDs occupy a separate namespace from
positional scale IDs. Scopes are restored after traversal/failure; signals and
computed mapping lifetimes are mount-owned.

These providers allocate no drawing box, position, clipping, or event targets.
Place marks and annotations using ordinary layout and positional scales. Read a
mapping with `.get()` inside a component to subscribe to its domain/color changes;
retain the returned hook signal for stable provider identity.

## Threshold colors

`ThresholdColorScale` takes `id`, `thresholds`, `colors`, and optional `children`.
`useThresholdColorScale(id): Signal<ResolvedThresholdColorScale>` returns frozen
`thresholds`, `colors`, `bands`, and `map(value: number): string`. Thresholds and
colors accept signals. Boundaries must be finite and strictly increasing with no
duplicates; colors must contain exactly one more entry than boundaries.

Each frozen `ThresholdColorBand` has `lower: number | undefined`,
`upper: number | undefined`, and canonical `color: string`. Lower bounds are
inclusive and upper bounds exclusive: equality belongs to the next/upper bucket.
Undefined edges are unbounded. Empty thresholds with one color define a constant
mapping with one unbounded band. Nonfinite map inputs reject. This is threshold
classification, not quantization or distribution-derived quantiles. No data is
aggregated or sorted on the caller's behalf. The same context, palette, failure,
and ownership rules apply as for the continuous families.

[Minimal executable example](../../minimal/viz/colors.tsx)
