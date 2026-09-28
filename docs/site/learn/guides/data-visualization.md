---
id: guide-data-visualization
title: Compose data visualizations
summary: Build allocated, signal-driven line plots with the official @crc/viz primitives.
kind: guide
slug: data-visualization
order: 67
keywords: [visualization, charts, line, scale, brush]
exampleSlug: viz-responsive-line
---

# Compose data visualizations

`@crc/viz` provides scale and drawing primitives. Core owns layout, signals,
events, clipping, and the JSX runtime. No chart container or second rendering
loop is required.

```tsx
import { Absolute, Group } from "@crc/core";
import { Axis, LineSeries, Scale } from "@crc/viz";

const readings = [
  { time: 0, value: 10 },
  { time: 1, value: 25 },
  { time: 2, value: null },
  { time: 3, value: 20 },
  { time: 4, value: 40 },
];

<Group style={{ translateX: 48, translateY: 16 }}>
  <Absolute style={{ width: 400, height: 200 }}>
    <Scale id="x" type="linear" domain={[0, 4]} range="width">
      <Scale id="y" type="linear" domain={[0, 50]} range="height" reverse>
        <Axis scale="x" position="bottom" />
        <Axis scale="y" position="left" />
        <LineSeries data={readings} x="time" y="value" xScale="x" yScale="y" />
      </Scale>
    </Scale>
  </Absolute>
</Group>;
```

The Group supplies gutters; Absolute supplies a finite local allocation. A Grid
or Flex parent can allocate that plot instead. Width and height ranges use the
plot's allocation, not a shared global chart rectangle. Null creates a real gap.

Pass core signals directly to data, domain, range, reverse, or declared style
inputs. The receiving component owns those reads. Calling `.get()` yourself
instead makes the enclosing component the consumer. Scale uses a stable computed
signal as layout and props change, without render-time writes.

Use `useScale(id).get().map(value)` for custom marks and `invert(pixel)` for
inspection. Event coordinates are root-logical; convert them to the plot's local
space before inversion. `ScaleAdjust` positions ordinary CRC children using that
mapping. Scales neither clip nor invent event targets.

## Explore an actual record

The [CO₂ explorer](#/examples/composition/viz-responsive-line) embeds 504 NOAA
GML/Scripps monthly observations from 1980–2021. Hover or tap to inspect, click to
pin, drag the overview selection to pan, and drag an edge/date callout to resize.
The example's brush uses ordinary pointer capture and signals; it is not a new
public chart or brush component. Data attribution and the source snapshot are
included in its editable source.

**Known gap:** the example currently has a desktop-oriented layout. Phone-sized
presentation and a fully evaluated casual-touch experience remain deferred.
General responsive style queries are a separate design exploration, not part
of `@crc/viz`.

Linear scales and linear curves are the current scope. Time/UTC, band scales,
additional curves and series, automatic legends, and nearest-datum interaction
are future work, not implicit guarantees of these primitives.
