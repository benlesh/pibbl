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

Linear and band scales are available; line curves are linear. Time/UTC,
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

## Categorical comparisons

The [band scales and bars example](#/examples/composition/viz-band-bars) uses
an ordered category domain and a numeric value scale to compare population changes
in the six most populous U.S. states (Census Bureau, Vintage 2023). Positive and
negative bars share a zero baseline. Hover or tap reveals exact counts without
changing the bar geometry. Missing-value behavior is covered in the tests.

```tsx
<Scale
  id="channels"
  type="band"
  domain={["Search", "Email"]}
  range="width"
  paddingInner={0.3}
  paddingOuter={0.2}
>
  <Scale id="change" type="linear" domain={[-30, 30]} range="height" reverse>
    <BarSeries
      data={[
        { channel: "Search", change: 20 },
        { channel: "Email", change: -10 },
      ]}
      x="channel"
      y="change"
      xScale="channels"
      yScale="change"
    />
  </Scale>
</Scale>
```

Import `BarSeries` from `@crc/viz`. `useScale("channels", "band").get()` exposes
band starts and bandwidth for composed labels and inspection. Categories are
strings or finite numbers; order is explicit, duplicates reject, and unknowns
map to undefined. Padding and domain can be signals. This feedback slice supports
vertical value and range bars; horizontal bars remain deferred.

For grouped bars, nest another band scale with
`range={{ bandwidthOf: "categories" }}` and pass paired `group` and
`groupScale` props to the same BarSeries. Its inner domain sets group order;
missing rows leave their slots empty. A style callback supplies per-row colors
without splitting the series. See [Grouped bars](#/examples/composition/viz-grouped-bars)
for a complete editable example with two or three groups, responsive sizing,
and inspection.

To color different value regions within the same bar, pass a threshold fill in
`style`: `{ fill: { type: "threshold", thresholds: [0, 300_000], colors:
["orange", "green", "red"] } }`. One `BarSeries` paints all intervals; a bar
crossing a threshold changes color there while retaining one border and target.
Thresholds use the numeric value scale's domain, not pixels. The population
example demonstrates this with green gains up to 300,000 and red above it.

For stacked bars, derive each segment's start and end in a pure data transform,
then pass `yStart` and `yEnd` in place of `y` and `baseline`.
The same styles and grouped positioning apply. See
[Stacked bars](#/examples/composition/viz-stacked-bars) for positive and negative
cash flows with segment inspection. The example defines stack order and separate
positive/negative accumulators; the renderer does not choose a stacking policy.

## Compose a pie with coordinated labels

`pieSlices(data, { value: "amount", keyBy: "id" })` remains a pure geometry helper.
For coordinated label layout, use `PieLayout` with ordinary `PieSlice` and
`PieLabel` children:

```tsx
const label = (slice) => `${slice.datum.name} · ${slice.value}`;

<PieLayout
  data={data}
  value="amount"
  keyBy="id"
  label={label}
  placement="auto"
  style={{ cx: 300, cy: 200, radius: 110, labelFont: "14px sans-serif" }}
>
  {(slice) => (
    <PieSlice slice={slice} style={{ fill: slice.datum.color }}>
      <PieLabel slice={slice} />
    </PieSlice>
  )}
</PieLayout>;
```

Label text is declared before children render, so the chart measures and places
it once without evaluating arbitrary component trees. Keep callbacks stable and
use immutable data updates to reuse computed angles and placements. Paint-only
selection updates need no new label measurement or collision layout. Core still
repaints the Canvas normally.

Choose `inside`, `outside`, or `auto`. Auto moves non-fitting labels outside;
strict inside omits them. Outside labels pack into separate left/right lanes,
with leaders entirely outside the circle. If the available bounds cannot hold
all labels, `slice.label` exposes a hidden result and reason. No small wedge is
inflated or silently aggregated. Compose an interactive key as an alternative
to hitting tiny slices. `PieLabel` is decorative unless explicitly given
`pointerEvents="auto"`; its target does not enlarge the wedge.

The [pie composition](#/examples/composition/viz-pie-composition) includes all
three modes, tiny categories on both sides, long names, reordering, and limited
label space. It keeps the hover/pinned readout in a reserved area outside the
whole pie. A full chart or automatic legend is not required.

Values must be nonnegative and finite; missing values have zero area. See
[pieSlices](#/api/functions/pie-slices) and
[PieLayout](#/api/components/pie-layout) for identity, empty-data, and placement
contracts. The initial label renderer supports single-line text. Custom label
content and donuts remain later additions.
