---
id: api-component-interval-series
title: Estimate-and-interval series
summary: Draw supplied estimates and asymmetric bounds at categorical centers.
kind: api
slug: interval-series
apiCategory: component
symbols:
  [
    HorizontalIntervalSeries,
    VerticalIntervalSeries,
    HorizontalIntervalSeriesProps,
    VerticalIntervalSeriesProps,
    IntervalSeriesProps,
    IntervalSeriesStyle,
  ]
---

# Estimate-and-interval series

Import `HorizontalIntervalSeries` and `VerticalIntervalSeries` from
`@pibbl/core/viz`. Both return ordinary Pibbl content with an interval, endpoint
caps, and an estimate circle per record. They render supplied results without
calculating uncertainty, weighting, pooling, or selecting a statistical method.

```tsx
import { HorizontalIntervalSeries } from "@pibbl/core/viz";
const effects = [
  { study: "Trial A", effect: 0.72, ciLower: 0.58, ciUpper: 0.89 },
];
<HorizontalIntervalSeries
  data={effects}
  category="study"
  estimate="effect"
  lower="ciLower"
  upper="ciUpper"
  categoryScale="studies"
  valueScale="effect"
/>;
```

Required props are `data`, `category`, `estimate`, `lower`, `upper`,
`categoryScale`, and `valueScale`. `data` is a readonly array or signal. Accessors
are field keys or synchronous `(datum, index, data)` callbacks. The categorical
scale is a `PointScale` or `BarScale`; band categories use their centers. The
value scale is continuous: linear, UTC, log, or symlog. Bounds and estimate map
independently, including reversed ranges. The estimate is not required to lie
inside the interval. Interval meaning and units belong in application labels.

`defined?` excludes rows before other accessors run. Nullish/nonfinite numeric
coordinates, missing categories, and categories absent from the declared domain
omit the entire row before bounds validation. For included categories, finite
reversed bounds throw a row-specific `RangeError`;
equal bounds are allowed. Invalid log inputs throw under the scale contract.
Mapping does not clamp or clip. Accessor signal reads belong to the series;
accessors cannot call hooks or write signals during rendering.

`style` accepts a whole-object signal and shallow field signals. Supported fields:
`radius` (default 4 pixels), `capSize` (full cap length, default 8 pixels), `fill`
(circle fill, default `#087f8c`), `stroke` (interval/cap/circle outline, same
default), `strokeWidth` (default 1.5 pixels), `lineInteractionWidth` (defaults to
stroke width), `opacity` (default 1), and `cursor`. Geometry sizes are finite and
nonnegative; opacity is finite in [0, 1]. Zero radius/cap size hides that part.
Per-datum styles and weight-driven marker areas are not supported by these marks.

Records preserve source paint order, painting each interval and caps before its
circle. The series composes ordinary Line/Circle targets, rather than allocating
a hit rectangle over the row. Series event handlers receive bubbled mark events;
events do not infer a datum. Use `pointerEvents="none"` for decorative marks.
Compose normal application-owned row controls for selection and keyboard focus.
Core transforms, explicit Clip, scheduled updates, and teardown apply. No layout,
second scheduler, or inference engine is introduced.

The [clinical forest plot](#/examples/composition/viz-clinical-forest) demonstrates
synthetic supplied risk ratios and 95% confidence intervals, sorting, row
inspection, and an application-owned accessible HTML results table.
