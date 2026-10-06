---
id: api-component-legend-item
title: Legend items
summary: Compose a legend from decorative swatches and labels with explicit layout ownership.
kind: api
slug: legend-item
apiCategory: component
symbols: [LegendItem, LegendItemProps]
---

# Legend items

`LegendItem(props: LegendItemProps)` from `@pibbl/core/viz` returns a square swatch
and a single-line label. It does not read a scale, derive series colors, allocate
layout, clip text, or create interaction targets. The caller positions each item
with core layout or `Group`, and owns the space reserved around the plot.

Required `label: SignalValue<string>` supplies the text and
`color: SignalValue<NonNullable<AxisStyle["fill"]>>` supplies the swatch paint.
`swatchSize?: SignalValue<number>` defaults to 14 logical pixels;
`gap?: SignalValue<number>` defaults to 4. The square starts at (0, 0); the label
starts at x = size + gap, vertically centered at y = size / 2.

Optional signal-valued `style` accepts signal-valued `font` (default
`12px sans-serif`), `fill` (label color, default `#617783`), and `opacity` (both
swatch and label, default 1). Labels retain their entire text; there is no implicit
truncation, collision skipping, or wrapping. Reserve enough height for both the
font and swatch. For long labels, allocate another row or compose your own label
using core Text. Put responsive `style.when` queries on the owning layout/Group.

Non-string or multiline labels throw `TypeError`. Nonpositive/nonfinite swatch
sizes, negative/nonfinite gaps, overflowing size-plus-gap, and opacity outside
0–1 throw `RangeError`. Font/paint handling follows core Text/Rectangle semantics.
Signals update text and paint on the scheduled render and unsubscribe on removal
or disposal. These are decorative entries; implement toggles with explicit core
focusable controls when needed, rather than implying hidden series filtering.

## Minimal runnable legend

```tsx
import { Group, pibbl } from "@pibbl/core";
import { LegendItem } from "@pibbl/core/viz";
export default function mount(canvas: HTMLCanvasElement) {
  return pibbl(canvas, <>
    <Group style={{ translateX: 20, translateY: 20 }}>
      <LegendItem label="Gain" color="#087f8c" />
    </Group>
    <Group style={{ translateX: 120, translateY: 20 }}>
      <LegendItem label="Loss" color="#b65a35" />
    </Group>
  </>);
}
```

The [population composition](/examples/composition/viz-signed-population) places
these entries below the plot and keeps every category visible in shallow embeds.
