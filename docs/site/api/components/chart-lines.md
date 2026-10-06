---
id: api-component-chart-lines
title: Grid and reference lines
summary: Decorative scale-aligned guides with explicit composition-owned spans.
kind: api
slug: chart-lines
apiCategory: component
symbols: [GridLines, ReferenceLine, ChartLineProps, GridLinesProps, ReferenceLineProps]
---

# Grid and reference lines

Import `GridLines` and `ReferenceLine` from `@pibbl/core/viz`.
`GridLines(props: GridLinesProps)` and `ReferenceLine(props: ReferenceLineProps)`
return ordinary decorative Pibbl lines. They allocate no layout, labels, titles,
or interaction regions. Source order controls painting; place them before marks.

Both require `scale: ScaleId`, `direction: "horizontal" | "vertical"`, and
`span: SignalValue<readonly [number, number]>`. Direction is the direction the
line extends: horizontal lines map values to y, vertical lines map values to x.
The span supplies the other coordinate's two endpoints in local logical pixels.
Descending and zero-length spans are valid. Nothing is implicitly clipped.

`GridLines` accepts either `tickValues: SignalValue<readonly (number | string)[]>`
or `tickCount?: SignalValue<number>` (default 5), never both. It uses exactly the
Axis tick selection rules, including band centers and point positions. Explicit
ticks must be unique, in-domain values, at most 100. Count is an integer 0–100;
zero paints nothing. Scale ticks may interpret positive count as a target.
Grid density is independent of label visibility; share explicit tick values with
an Axis when their positions must match.

`ReferenceLine` requires `value: SignalValue<string | number>`. Continuous scales
require a finite numeric in-domain value; categorical scales require a known
category. Band references pass through band centers.

Both accept a signal-valued `style` with signal-valued `stroke` (default
`#dce5e8`), `strokeWidth` (default 1), and `opacity` (default 1). Width must be
finite and nonnegative; opacity must be finite and between 0 and 1. Lines ignore
pointer events. Wrap them in ordinary core compositions for transforms/clipping.

Missing/unknown scale IDs and invalid directions throw `TypeError`. Invalid
spans, out-of-domain/duplicate ticks, invalid counts, widths, or opacity throw
`RangeError`; nonnumeric continuous values throw `TypeError`. Scale-provider
validation still applies. Signal changes schedule geometry/paint updates;
subscription ownership ends on removal or disposal.

## Minimal runnable composition

```tsx
import { pibbl } from "@pibbl/core";
import { LinearScale, GridLines, ReferenceLine } from "@pibbl/core/viz";
export default function mount(canvas: HTMLCanvasElement) {
  return pibbl(canvas,
    <LinearScale id="y" domain={[-10, 10]} range={[180, 20]}>
      <GridLines scale="y" direction="horizontal" span={[20, 280]} tickValues={[-10, 0, 10]} />
      <ReferenceLine scale="y" direction="horizontal" span={[20, 280]} value={0} style={{ stroke: "#087f8c", strokeWidth: 2 }} />
    </LinearScale>);
}
```

The [signed population example](/examples/composition/viz-signed-population)
uses horizontal guides and a zero reference across responsive symlog geometry.
