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
Core supports responsive style queries on returned CRC elements; conditional
styles for viz-owned marks remain a separate follow-up.

Linear scales and linear curves are the current scope. Time/UTC, band scales,
additional curves and series, and automatic legends remain future work.
Nearest-data inspection is available through the functions below.

## Dots and custom marks

Use `PointSeries` for circles with bounded component/event overhead; radius uses
local pixels. A shared style accepts shallow signals, while a per-datum style
callback returns plain paint/radius values. Circles paint fill then stroke in
source order, preserving transparent overlap. The series has one union target;
nearest-data lookup is separate from topmost painted hit testing.

Use `PlotSeries` for ordinary CRC elements at each data coordinate. Its required
`render(datum, index, data)` callback returns nodes; hooks belong in returned
components. Supply `keyBy` for mutable data to preserve per-row state on reorder.
Missing coordinates skip rows. A callback that returns null retains its row
wrapper; removing/invalidation of a row unmounts it. Custom trees cost ordinary
per-row nodes and targets. The [penguin example](#/examples/composition/viz-points-and-inspection)
compares both approaches with a static credited dataset.

## Function-based hover queries

`HoverData` calls an ordinary synchronous query during rendering, then passes its
inferred result to a function child. Custom queries need no registration:

```tsx
<HoverData
  query={(context) => {
    const selected = selection.get();
    if (!selected) return undefined;
    return {
      datum: selected,
      anchor: {
        x: context.scale("x").map(selected.time),
        y: context.scale("y").map(selected.value),
      },
    };
  }}
>
  {(hit) => hit && <Reading datum={hit.datum} anchor={hit.anchor} />}
</HoverData>
```

Query/render-callback signal reads belong to the receiving HoverData. Queries
cannot write signals, call hooks, return promises, or retain the scale context.
Return components for hooks. Changing the query function does not remount same
returned component types/keys. Undefined is passed to the callback so it controls
empty behavior. Compose query functions by calling each with the same context.

`defineSeries({data,x,y,defined?})` is an optional shallow-frozen descriptor helper;
plain compatible descriptors also work. It observes nothing until queried.

| Query factory  | Selection                                                      | Result                                                                    |
| -------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `closestPoint` | One mapped point across named datasets, Euclidean local pixels | Series key, original datum/index, domain x/y, local anchor, distance      |
| `closestX`     | One recorded point nearest a domain x; ignores pointer y       | Original datum/index, actual x/y, local anchor, delta                     |
| `interpolateX` | One exact or estimated value at the requested domain x         | Discriminated exact datum or interpolated endpoints, fraction, and anchor |

Factories return ordinary functions for HoverData. Inputs accept data/position
signals; null inspection yields undefined. Nearest ties preserve series-key and
source order. maxDistance uses local pixels; maxDelta and maxGap use domain units.
Use separate closestX queries for two recorded values, or separate interpolateX
queries at the same time for two aligned estimates. They may also be combined in
one custom function returning a comparison object.

Interpolation requires nondecreasing source x and an explicit interpolation
function, such as `linearInterpolation()`. Duplicate x values error by default;
choose `duplicateX: "first"` or `"last"` deliberately. Missing/undefined rows break
segments. No extrapolation or crossing missing-value gaps occurs. maxGap limits
bracketing intervals; exact records still work. Estimates are computed in data
space before mapping and retain both original endpoints, never a fabricated datum.

The [two-line comparison](#/examples/composition/viz-hover-comparison) contains
complete wiring for one nearest point, nearest points per line, and shared-time
interpolation, using real NOAA monthly/deseasonalized values. Its pointer/drag
handlers convert root-logical x to plot-local x, then to domain time. The guide
uses an ordinary Line and pointer capture. No extra pointer tracker, Plot wrapper,
Chart container, or scheduler is required.

## Cards that protect the inspected point

Render `HoverCard` after the series, at plot origin, using a local anchor:

```tsx
<HoverCard
  anchor={hit.anchor}
  anchorRadius={6}
  gap={8}
  style={{ width: 156, height: 32, padding: 10 }}
>
  <Text pointerEvents="none" style={{ font: "12px sans-serif" }}>
    {hit.datum.label}
  </Text>
</HoverCard>
```

Width/height are declared **content sizes**; padding adds to the outer box. The
rounded translucent background passes pointer input through. Set decorative
children to pointerEvents none too; explicitly interactive children retain normal
targets. No recursive pointer suppression is invented.

Auto placement tries above, below, right, left, sliding only along a side. It
keeps the outer border clear of radius plus gap. If no placement fits, it overflows
rather than covering the protected anchor; ancestor clips still apply. Explicit
bounds use the same local frame. This protects the declared card box, not arbitrary
overflowing or filtered child paint, and does not prevent multiple cards from
colliding with each other. Preferred sides can help separate two readouts.

Viz-owned shared styles support ordinary signals and layout-driven reflow.
Returned CRC marks support core responsive style queries against their containing
allocation. Direct conditional-style support for viz-owned styles remains deferred.

For multiple readouts, use [AnchoredLayout](#/api/components/anchored-layout)
instead of positioning each HoverCard independently. Give it keyed items with
local anchors and declared outer sizes; its child callback renders ordinary CRC
content at each placed origin. It arranges the boxes together and keeps them
clear of every supplied anchor. The Hover comparisons lesson demonstrates this
with connector lines and a shared column that flips at the plot edge.
