---
id: api-component-chart-editing
title: Editable chart annotations
summary: Controlled range, reference, and trend annotations for continuous chart scales.
kind: api
slug: chart-editing
apiCategory: component
symbols:
  [
    RangeNavigator,
    RangeNavigatorProps,
    RangeNavigatorStyle,
    EditableReferenceLine,
    EditableReferenceLineProps,
    EditableReferenceLineStyle,
    EditableReferenceBand,
    EditableReferenceBandProps,
    EditableReferenceBandStyle,
    EditableTrendLine,
    EditableTrendLineProps,
    EditableTrendLineStyle,
    ChartAnchor,
  ]
---

# Editable chart annotations

`RangeNavigator`, `EditableReferenceLine`, `EditableReferenceBand`, and
`EditableTrendLine` provide controlled Canvas interactions. Import them from
`@pibbl/core/viz`; keep the application value in a signal or other state and
feed each `onChange` result back through its matching prop.

```tsx
import { signal } from "@pibbl/core";
import { EditableReferenceLine, LinearScale } from "@pibbl/core/viz";

const level = signal(102.5);
const selected = signal(false);
const plotLeft = 20;
const plotRight = 180;

function saveLevel(nextLevel: number) {
  level.set(nextLevel);
}

function PriceReference() {
  return (
    <LinearScale id="price" domain={[95, 110]} range={[160, 20]}>
      <EditableReferenceLine
        scale="price"
        direction="horizontal"
        value={level}
        span={[plotLeft, plotRight]}
        selected={selected}
        keyboardStep={0.25}
        onSelect={() => selected.set(true)}
        onChange={level.set}
        onCommit={saveLevel}
        onCancel={() => selected.set(false)}
        style={{ stroke: "#d97706", handleSize: 8, hitSize: 24 }}
      />
    </LinearScale>
  );
}
```

`RangeNavigator`, `EditableReferenceLine`, and `EditableReferenceBand` require
an invertible numeric continuous scale: linear, UTC, log, or symlog.
`RangeNavigator` pans its interior and resizes from either edge. Reference lines
and bands accept a `direction` and an explicit perpendicular `span`. Their
interior pans; selected bands expose two resize handles. `EditableTrendLine` has
endpoint handles and a whole-line drag. Its y scale is numeric; its x scale may
also be `TradingTimeScale`. With `TradingTimeScale`, x edits snap to supplied
timestamps and whole-line drags preserve the shared observation-slot delta.

RangeNavigator values describe a bounded viewport interval and must remain
inside its numeric scale domain. Reference-line, reference-band, and numeric
trend anchors are annotations: their controlled values may extend beyond the
current visible scale domain. Continuous pointer and keyboard edits extrapolate
those annotations; only the geometry intersecting the visible range is painted.
Trading-time trend x values remain limited to supplied observations.

Changes are synchronous and controlled: pointer movement calls `onChange`, then
the application supplies the next prop. Pointer release calls `onCommit` with
the last emitted draft, including a release before a scheduled render. Escape
and pointer cancellation restore the value present at drag start through
`onChange`, then call `onCancel`. Arrow keys make one finite positive
`keyboardStep` edit and commit it. Trend arrows move x with Left/Right and y
with Up/Down. All handles use Pibbl pointer capture, so a
drag continues outside the painted mark. With `minimumSpan={0}`, RangeNavigator
uses one percent of its numeric domain span as its arrow-key step.

`style` accepts a whole-object signal and field signals for `fill`, `stroke`,
`strokeWidth`, `opacity`, `handleFill`, `handleStroke`, `handleSize`, and
`hitSize`. The first four paint the annotation. Handle colors are independently
painted at full opacity; handle size is visual and hit size is independent.
Values outside a visible range remain controlled values; only their visible
geometry is painted.

The [financial research workspace](#/examples/composition/financial-research-workspace)
combines all four controls with a trading-time price chart.
