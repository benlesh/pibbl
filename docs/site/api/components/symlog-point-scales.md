---
id: api-component-symlog-point-scales
title: Symlog and point scales
summary: Signed numeric mappings through zero and evenly spaced categorical positions.
kind: api
slug: symlog-point-scales
apiCategory: component
symbols: [SymlogScale, useSymlogScale, SymlogScaleProps, ResolvedSymlogScale, PointScale, usePointScale, PointScaleProps, ResolvedPointScale]
---

# Symlog and point scales

Import from `@pibbl/core/viz`. Each family has its own provider and hook with a
fixed return type. There is no family selector or argument-dependent return.

## SymlogScale

`SymlogScale(props: SymlogScaleProps): PibblNode` accepts all `LinearScaleProps`
and `constant?: SignalValue<number>` (default 1). `id`, `domain`, and `range` are
required. `reverse` defaults to false; style and children are optional.
The domain is two distinct finite numbers with a finite nonzero span; negative,
zero, positive, and descending endpoints are supported. Range is `"width"`,
`"height"`, or two finite coordinates. Reversal affects range only.

`useSymlogScale(id: ScaleId): Signal<ResolvedSymlogScale>` returns a stable shared
readonly signal. Its frozen snapshot has `type: "symlog"`, frozen `domain` and
`range`, `frame`, `constant`, and:

- `map(value: number): number`: applies `sign(value) * log1p(abs(value)/constant)`
  before linear interpolation. Near zero it is approximately linear; farther
  away it compresses large magnitudes. Finite values outside the domain extrapolate.
- `invert(pixel: number): number`: applies the inverse signed `expm1` transform.
  Original range endpoints return exact domain endpoints. Negative zero becomes zero.
- `ticks(count = 5): readonly number[]`: readable 1/2/5 decimal ticks in **data
  space**, using `linearTicks(domain, { count })`. Count is a target, not exact;
  at most 100 values are returned. Count must be an integer 2–100. Aligned zero
  appears when the domain crosses zero. Endpoints appear only if aligned.

`constant` must be finite and positive, in the same units as the data. Changing
it changes geometry; it is not only a formatting choice. No automatic nicening
or clamping occurs. All provider inputs except identity/children accept the same
signals as LinearScale. Changes to constant publish new snapshots. Hook `.get()`
tracks dependencies; provider unmount releases its subscriptions.

Invalid domains, ranges, constants, nonfinite map/invert inputs or outputs,
collapsed transformed domains, and collapsed-range inversion throw `RangeError`.
A collapsed range can still map. Tick precision limits match `linearTicks`.
Missing/mismatched hook IDs and invalid reverse/identity follow existing scale
errors. Existing numeric axes, marks, `ScaleAdjust`, and inspection queries work
with symlog, including signed coordinates and zero.

## PointScale

`PointScale(props: PointScaleProps): PibblNode` requires `id`, `domain`, and
`range`. Domain is an ordered array of unique strings or finite numbers; numeric
`1` and string `"1"` differ, while `0` and `-0` are duplicates. Empty and singleton
domains are valid. Range, reverse (default false), style, and children have the
same meaning as LinearScale. `padding?: SignalValue<number>` defaults to zero;
it is nonnegative outer spacing in step units, not pixels. Zero padding places
first and last categories at the range endpoints. Categories never sort themselves;
reverse the domain array to change order, or reverse the range to flip mapping.

`usePointScale(id: ScaleId): Signal<ResolvedPointScale>` returns a stable shared
readonly signal. Snapshot fields: `type: "point"`, frozen `domain` and `range`,
`frame`, resolved `padding`, and nonnegative `step`. There is no bandwidth.

- `map(category: BandCategory): number | undefined`: the category's point,
  or undefined for an unknown category. No domain mutation occurs.
- `invert(pixel: number): BandCategory | undefined`: nearest-category lookup,
  not a continuous inverse. Ties choose the first category in domain order;
  outside coordinates choose the nearest endpoint. Empty domains return
  undefined. Singleton or collapsed ranges choose the first category.
- `ticks(count = 5): BandDomain`: at most count categories, sampled in domain
  order. Count is an integer 0–100; zero returns an empty frozen array, one
  returns the first category. Counts of two or more retain endpoints.

Empty domains have step zero; singleton categories map to the range midpoint.
Collapsed ranges place all categories at that pixel. Padding arithmetic must
remain finite. Invalid/duplicate categories throw `TypeError`; invalid padding,
range/allocation, invert coordinate, or count throws `RangeError`. No implicit
category coercion occurs. Domain, range, reverse, padding, and styles accept
signals; snapshots update with allocation, and unmount releases subscriptions.

Axis ticks use the exact point (no half-band offset). `ScaleAdjust` accepts
string/number point coordinates for ordinary custom marks; unknown categories
throw `RangeError`. Its continuous coordinates still require numbers. Numeric
`LineSeries`, `PointSeries`, `PlotSeries`, and numeric inspection queries do not
accept PointScale: use the hook for custom mark coordinates and `invert` for
category inspection. This preserves their numeric contracts.

## Minimal runnable composition

The [signed Census example](#/examples/composition/viz-signed-population) is
editable and uses both providers and hooks with real data. This minimal mount
also demonstrates both families and categorical custom-mark placement:

```tsx
import { Circle, Group, pibbl } from "@pibbl/core";
import { Axis, PointScale, SymlogScale, ScaleAdjust } from "@pibbl/core/viz";
export default function mount(canvas: HTMLCanvasElement) {
  return pibbl(canvas, <Group style={{ translateX: 60, translateY: 30 }}>
    <PointScale id="state" domain={["A", "B", "C"]} range={[0, 120]}>
      <SymlogScale id="change" domain={[-100, 100]} range={[0, 240]} constant={10}>
        <Axis scale="state" position="left" tickValues={["A", "B", "C"]} />
        <Axis scale="change" position="top" />
        <ScaleAdjust x={-30} xScale="change" y="B" yScale="state">
          <Circle style={{ radius: 5, fill: "teal" }} />
        </ScaleAdjust>
      </SymlogScale>
    </PointScale>
  </Group>);
}
```

Keep category identities visible when resizing. Units and the symlog transition
constant belong in chart context because equal distances do not represent equal
additive changes.

Scale snapshots are computed lazily. Domain/mapping validation occurs when a
consumer reads the scale signal (for example, an Axis or a hook's `.get()`),
not merely because an otherwise unused provider appears in the tree.
