---
id: api-component-weighted-point-series
title: Weighted point series
summary: Draw points whose visible area is proportional to supplied research weights.
kind: api
slug: weighted-point-series
apiCategory: component
symbols:
  [
    WeightedPointSeries,
    WeightedPointSeriesProps,
    WeightedPointSeriesStyle,
    WeightAccessor,
  ]
---

# Weighted point series

`WeightedPointSeries` maps x and y observations and converts a supplied weight to
circle area. It does not calculate precision, sample size, effect estimates, or
any statistical summary.

```tsx
import { WeightedPointSeries } from "@pibbl/core/viz";
const assayObservations = [{ concentration: 1, inhibition: 49, precision: 64 }];
<WeightedPointSeries
  data={assayObservations}
  x="concentration"
  y="inhibition"
  weight="precision"
  xScale="concentration"
  yScale="inhibition"
  weightDomain={[0, 100]}
  radiusRange={[0, 10]}
/>;
```

Required props are `data`, `x`, `y`, `weight`, `xScale`, `yScale`, and
`weightDomain`. Coordinate and weight accessors are field keys or synchronous
callbacks. Both coordinate scales follow `PointSeries`: each can be continuous
or categorical where supported by the selected scale.

`weightDomain` is `[0, maximum]`, where `maximum` is finite and positive. The
zero baseline is required so a mark's area is proportional to its supplied
weight. `radiusRange` is `[0, maximumRadius]` and defaults to `[0, 6]` local
units. The radius is `maximumRadius * sqrt(weight / maximum)`. A zero or nullish
weight omits a mark; negative, nonfinite, and out-of-domain weights throw. The
component never clamps or infers a weight.

`style` is shared across marks and supports whole-object and shallow signals.
Its fields are `fill` (default `#087f8c`), `stroke`, `strokeWidth` (default 1),
`opacity` (default 1), and `cursor`. Radius is intentionally derived only from
weight. `defined` omits a record before other accessors run. Missing coordinates
omit that record under the ordinary series contract.

Marks retain source paint order and are batched into one ordinary Pibbl pointer
target. Series event handlers receive ordinary bubbled events rather than an
inferred datum. Use `pointerEvents="none"` for decorative points. Signals update
on Pibbl's scheduler; the component owns no retained resources or inference
state.
