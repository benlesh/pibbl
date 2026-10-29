---
id: api-component-paired-series
title: Paired series
summary: Connect complete supplied before-and-after outcomes without imputing missing values.
kind: api
slug: paired-series
apiCategory: component
symbols: [PairedSeries, PairedSeriesProps, PairedSeriesStyle]
---

# Paired series

`PairedSeries` connects two supplied outcomes in each wide record. Both
endpoints must be observed; an incomplete pair contributes no segment. It does
not match subjects across tables, calculate change, or replace missing outcomes.
Compose `PointSeries` for endpoint circles, including unpaired observations.

```tsx
import { PairedSeries } from "@pibbl/core/viz";
const participants = [
  { id: "P01", baseline: 62, week12: 44 },
  { id: "P02", baseline: 58, week12: null },
];
<PairedSeries
  data={participants}
  before="baseline"
  after="week12"
  beforeX="Baseline"
  afterX="Week 12"
  xScale="endpoint"
  yScale="score"
  style={{ stroke: "#087f8c" }}
/>;
```

Required props are `data`, `before`, `after`, `beforeX`, `afterX`, `xScale`,
and `yScale`. Outcome accessors are numeric field keys or synchronous callbacks.
Endpoint x coordinates are explicit numeric or PointScale category positions.
Missing or nonfinite outcomes omit the entire pair. Unknown PointScale endpoint categories throw under the standard series coordinate contract; continuous x coordinates must be numeric. `defined` excludes a record
before outcome accessors run. Lines retain source encounter order.

Shared `style` supports `stroke` (default `#2563eb`), `strokeWidth` (default
2 local units), `opacity` (default 1), `cursor`, and `lineInteractionWidth`
(default stroke width). Whole-object and shallow field signals schedule updates.
Each component returns one batched ordinary Pibbl Path, with standard events and
`pointerEvents`. Events do not infer a participant or datum. Accessors are
synchronous and cannot call hooks or write signals. The component owns no
retained resources or statistical state.
