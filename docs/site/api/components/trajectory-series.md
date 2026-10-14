---
id: api-component-trajectory-series
title: Trajectory series
summary: Connect participant observations while preserving explicit missing-visit gaps.
kind: api
slug: trajectory-series
apiCategory: component
symbols:
  [
    TrajectorySeries,
    TrajectorySeriesProps,
    TrajectorySeriesStyle,
    TrajectoryGroupAccessor,
  ]
---

# Trajectory series

`TrajectorySeries` draws separate participant paths from interleaved long-form
records. `group` is a string/number field or synchronous accessor. Each group's
source order is preserved; the component never sorts visits or calculates a
summary. Supply rows for missed scheduled visits with null coordinates so the
path breaks. An absent row cannot communicate that a scheduled visit was missed.

```tsx
import { TrajectorySeries } from "@pibbl/core/viz";
const visits = [
  { participant: "P01", week: 0, change: 0 },
  { participant: "P01", week: 4, change: null },
  { participant: "P01", week: 12, change: -18 },
];
<TrajectorySeries
  data={visits}
  group="participant"
  x="week"
  y="change"
  xScale="week"
  yScale="change"
  style={{ stroke: "#087f8c" }}
/>;
```

Required props are `data`, `group`, `x`, `y`, `xScale`, and `yScale`.
X coordinates use continuous numeric or categorical PointScale positions; y outcomes use numeric scales. Missing
or nonfinite coordinates split only their group's current run; one-point runs
have no connecting segment. Nullish group keys omit a row. Other group keys must
be strings or finite numbers. `defined=false` breaks the identified group's run
before coordinate accessors are evaluated.

Shared `style` supports `stroke` (default `#2563eb`), `strokeWidth` (default
2 local units), `opacity` (default 1), `cursor`, and `lineInteractionWidth`
(default stroke width). Whole-object and shallow field signals schedule updates.
Each component returns one batched ordinary Pibbl Path, with standard events and
`pointerEvents`. Events do not infer a participant or datum. Accessors are
synchronous and cannot call hooks or write signals. The component owns no
retained resources or statistical state.
