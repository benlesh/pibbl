---
id: api-component-interval-diamond-series
title: Summary interval diamonds
summary: Render supplied summary estimates and confidence bounds as horizontal diamonds.
kind: api
slug: interval-diamond-series
apiCategory: component
symbols:
  [
    IntervalDiamondSeries,
    IntervalDiamondSeriesProps,
    IntervalDiamondSeriesStyle,
  ]
---

# Summary interval diamonds

Import `IntervalDiamondSeries` from `@pibbl/core/viz`. It renders supplied
summary results without estimating weights, pooling effects, or calculating
confidence intervals. Use it alongside ordinary study marks in a forest plot.

```tsx
import {
  IntervalDiamondSeries,
  LinearScale,
  PointScale,
} from "@pibbl/core/viz";

const summaries = [
  { analysis: "Supplied summary", estimate: 0.72, lower: 0.58, upper: 0.89 },
];
const result = (
  <PointScale id="analyses" domain={["Supplied summary"]} range={[40, 40]}>
    <LinearScale id="effect" domain={[0, 1.5]} range={[20, 300]}>
      <IntervalDiamondSeries
        data={summaries}
        category="analysis"
        estimate="estimate"
        lower="lower"
        upper="upper"
        categoryScale="analyses"
        valueScale="effect"
        style={{ height: 12 }}
      />
    </LinearScale>
  </PointScale>
);
void result;
```

`data` accepts a readonly array or signal. Accessors accept field keys or
synchronous `(datum, index, data)` callbacks. `categoryScale` names an ancestor
PointScale or BarScale; band categories use their centers. `valueScale` names an
ancestor continuous numeric scale. Lower and upper bounds map to the horizontal
tips; the estimate maps to both perpendicular vertices. Asymmetry is preserved,
including on log scales and reversed ranges. No containment, pooling, or
confidence level is inferred from category labels.

`defined` excludes rows before coordinate accessors. Missing/nonfinite
coordinates and unknown categories omit the complete row before bounds
validation. Included rows require `lower <= estimate <= upper`. Equal bounds
are accepted as degenerate outlined geometry. Invalid log inputs reject under
the scale contract. Accessors cannot call hooks or write signals.

Shared `style` supports whole-object and shallow signals: `height` (full local
pixel height, default 12), `fill` and `stroke` (default `#087f8c`), `strokeWidth`
(default 1.5), `lineInteractionWidth` (defaults to stroke width), `opacity`
(default 1), and `cursor`. Sizes must be finite and nonnegative; opacity lies in
[0, 1]. Zero height hides all marks. The series returns one batched ordinary
Path target. Overlapping contours share one fill/stroke operation and opacity;
ordinary handlers do not infer a datum. Use `pointerEvents="none"` for decorative
summaries. Compose explicit Clip, transforms, labels, row controls, and an HTML
table as needed. No core runtime changes or new resource lifetime are required.
