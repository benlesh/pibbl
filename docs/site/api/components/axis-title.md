---
id: api-component-axis-title
title: Axis titles and units
summary: Scale-aligned titles with explicit margins and optional units.
kind: api
slug: axis-title
apiCategory: component
symbols: [AxisTitle, AxisTitleProps]
---

# Axis titles and units

`AxisTitle(props: AxisTitleProps)` from `@pibbl/core/viz` paints one title using
an ancestor scale. It owns no layout or margin, modifies no ticks or marks, and
creates no hit target. Place it inside the same translated plot composition as
its Axis, reserving enough space outside that composition for the title.

Required properties are `scale: ScaleId`,
`position: "top" | "bottom" | "left" | "right"`, and
`label: SignalValue<string>`. `unit?: SignalValue<string>` appends a nonempty unit
as `label (unit)`; omitted or empty units append nothing. There is no conversion
of data or tick values. Format tick units separately with Axis/formatNumber.

The title centers on the scale's pixel-range midpoint, including descending
ranges. Top/bottom text is horizontal. Left text rotates −90 degrees and right
text +90 degrees. `offset?: SignalValue<number>` is the distance from the plot
edge to the text center in logical pixels, default 40. Edges use the scale's
allocation frame: left/top are zero, right/bottom are frame width/height. All
scale families work, including empty point/band domains with a valid range.

Optional signal-valued `style` accepts signal-valued `font` (default
`12px sans-serif`), `fill` (default `#617783`), and `opacity` (default 1).
Labels/units must be single-line strings; text is neither shortened nor wrapped.
The caller chooses responsive wording and offsets and may use allocation-relative
`style.when` on the owning Group to change presentation. The component does not
measure neighboring labels or automatically reserve space.

Missing/unknown scale IDs, invalid positions, or non-string/multiline label/unit
values throw `TypeError`. Negative/nonfinite offsets and opacity outside 0–1
throw `RangeError`. Core Text font/paint semantics apply. Signals and changes in
the provider's allocation update placement/text on the scheduled render;
subscriptions detach on removal or disposal.

## Minimal runnable title

```tsx
import { Group, pibbl } from "@pibbl/core";
import { Axis, AxisTitle, LinearScale } from "@pibbl/core/viz";
export default function mount(canvas: HTMLCanvasElement) {
  return pibbl(canvas,
    <Group style={{ translateX: 80, translateY: 30 }}>
      <LinearScale id="y" domain={[0, 100]} range={[150, 0]}>
        <Axis scale="y" position="left" />
        <AxisTitle scale="y" position="left" label="Mass" unit="kg" offset={55} />
      </LinearScale>
    </Group>);
}
```

The [population example](/examples/composition/viz-signed-population) labels its
vertical axis with people, keeping the unit visible even when the heading is
hidden in a shallow embed.

## Chart titles, captions, and source notes

Use core `Text` for chart prose. It already measures and wraps text within an
explicit box, with `lineHeight` and `fit` policies. No visualization-specific text
wrapper is needed. Parent layouts or Groups own placement and reserve space for
both the text and plot. For example:

```tsx
import { Group, Text, pibbl } from "@pibbl/core";
export default function mount(canvas: HTMLCanvasElement) {
  return pibbl(canvas, <>
    <Text style={{ left: 20, top: 20, width: 280, font: "600 24px sans-serif", fill: "#172f3d" }}>
      Population change
    </Text>
    <Group style={{ translateX: 20, translateY: 80 }}>
      <Text style={{ width: 280, height: 48, wrap: true, lineHeight: 16, fit: "ellipsis", font: "12px sans-serif", fill: "#617783" }}>
        Source: US Census Bureau, Vintage 2023. July 2022–July 2023; people.
      </Text>
    </Group>
  </>);
}
```

Use `style.when` width/height queries on core Text and its owning layout to adapt
captions and headings to their allocation. Keep essential units and attribution
visible in shallow embeds, and explicitly budget sufficient height for wrapped
text. See the core Text reference for fitting and signal behavior.

Simple legend keys likewise need only core shapes and Text: compose a Rectangle
or Line using the same paint as the marks, followed by its label. Keep data
visibility controls explicit. A separate viz component is useful only when it
adds scale/data behavior beyond that core composition.
