---
id: api-component-log-scale
title: LogScale
summary: Positive logarithmic coordinates with explicit power ticks and numeric inversion.
kind: api
slug: log-scale
apiCategory: component
symbols: [LogScale, LogScaleProps, useLogScale, ResolvedLogScale]
---

# LogScale

Import `LogScale` and `useLogScale` from `@pibbl/core/viz`. Equal ratios map to
equal distances. There is no generic scale-family selector.

```tsx
import { LogScale, Axis } from "@pibbl/core/viz";
<LogScale id="mass" domain={[1, 1000]} range="width" base={10}>
  <Axis scale="mass" position="bottom" />
</LogScale>;
```

## Provider signature and defaults

`LogScale(props: LogScaleProps): PibblNode` provides a named mapping to descendants.

| Input      | Default  | Contract                                                        |
| ---------- | -------- | --------------------------------------------------------------- |
| `id`       | required | Nonempty string or symbol                                       |
| `domain`   | required | Two distinct finite positive endpoints, ascending or descending |
| `range`    | required | `"width"`, `"height"`, or two finite numeric endpoints          |
| `reverse`  | `false`  | Reverses the range, independently of domain direction           |
| `base`     | `10`     | Finite number greater than 1; controls power ticks, not mapping |
| `style`    | omitted  | Existing scale layout style; layout ownership remains explicit  |
| `children` | omitted  | Ordinary Pibbl nodes                                            |

Domain, range, reverse, base, whole style, and declared style fields accept the
same signals as other scale providers. Changing base publishes a new snapshot
even when the mapping stays equal. The provider responds to its containing
allocation. No nicening or clamping is automatic.

## Hook and fixed return contract

`useLogScale(id: ScaleId): Signal<ResolvedLogScale>` returns one stable shared
readonly signal per provider. `.get()` reads the current frozen snapshot.
Missing IDs fail; reading a mismatched family throws `TypeError`. Signal reads
track the caller normally; the provider owns cleanup when unmounted.

The snapshot exposes `type: "log"`, frozen original `domain`, resolved `range`,
`frame`, `base`, and these methods:

- `map(value: number): number`: finite positive input to logical pixels. Positive
  out-of-domain values extrapolate. Zero and negative values are errors.
- `invert(pixel: number): number`: finite logical pixels to positive numeric
  values. Range endpoints return the exact original domain endpoints.
- `ticks(count = 5): readonly number[]`: frozen, ordered, bounded ticks.
  Count must be an integer 2–100. Both original endpoints are always included.
  Interior ticks are integer powers of `base`, subsampled by an integer exponent
  stride to fit the count. Two requests return only endpoints; intervals with
  no interior powers also return endpoints. Tick count is a maximum, not a
  promise of an exact number. Ticks never change mapping or domain.

A collapsed range maps all values to its single pixel but cannot be inverted.
A collapsed domain, nonpositive/nonfinite domain or map value, invalid base,
nonfinite span/output, invalid count, or unrepresentable tick exponent throws
`RangeError`. Extremely close endpoints whose logarithms become equal reject.
Inversion that overflows or underflows to zero rejects. Invalid reverse uses the
shared scale validation (`TypeError`). Malformed endpoints/ranges reject instead
of being coerced. A base very close to one may map normally but reject tick
requests whose integer exponents exceed numeric precision; use a larger base.

## Composition and inspection

Axes, `LineSeries`, `PointSeries`, `PlotSeries`, `ScaleAdjust`, `HoverData`,
`nearestPoint`, and `nearestDomainValue` accept this continuous mapping. Numeric
inspection measures distances after mapping. Missing/nonfinite samples retain
existing mark/query behavior; zero/negative log coordinates reject unless the
caller excludes them with `defined`. Value bars need an explicit positive
baseline or positive ranges; their default zero baseline is invalid on a log
scale. A log chart has no zero position.

Labels remain independent: use `Axis.labelOverlap="skip"` for crowded endpoints
and `formatNumber` for units. Never interpret a logarithmic bar length as an
additive magnitude. The NASA example uses equal-size dots instead.

## Runnable examples

The [minimal log demo](#/examples/composition/viz-log-basics) demonstrates the
provider, hook, mapping, inverse, and ticks. The
[NASA mass chart](#/examples/composition/viz-log-masses) compares checked-in
planetary data across orders of magnitude with touch/keyboard inspection.
