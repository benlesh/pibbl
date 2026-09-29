# Visualization expansion: points, custom plots, and inspection

Status: base design and function-based HoverData/HoverCard extension approved by the user on 2026-09-28. Extension implementation remains planned.
Execution approved by the user in an isolated worktree; delivery stops at the
first runnable slice for feedback.
Date: 2026-09-28. Source inspection: `4717dc9` plus the concurrent responsive
styles draft. No runtime verification is claimed by this document.

## Intent and scope

Continue the [approved visualization foundation](2026-09-24-first-class-data-visualization-foundation.md)
after its accepted desktop line-chart slice. The goal remains composable,
interactive visualization through ordinary CRC components, without D3, a Chart
container, or a second interaction/runtime system. Built-in series batch marks;
custom plotted elements explicitly opt into ordinary per-datum component trees.

The recommended next slice is `PointSeries`, `PlotSeries`, and pure nearest-data lookup:
one dataset displayed as points, and another displayed as a line with points,
plus user-authored CRC marks, with inspection and selection through ordinary CRC handlers. Existing linear
scales are sufficient. This follows the foundation's recorded continuation
point and the user's requested custom-element expansion. The API details below are approved.

The request for custom elements deliberately expands the foundation's earlier
batched-series-only boundary: `PointSeries` keeps that performance contract;
`PlotSeries` provides full CRC composition at the normal cost of those elements.
Do not implement PointSeries by creating one Circle component per row through
PlotSeries.

Alternatives considered:

- Band scales and `BarSeries` unlock categorical/grouped charts, but jointly
  require category identity, unknown categories, bandwidth, nested ranges,
  baseline, and geometry-union decisions. Design them as the next separate slice.
- Curves and richer axes improve the existing chart, but do not establish
  independent marks or reusable inspection. Their previously approved direction
  remains intact and can follow independently.

The full future surface is not an implementation queue. Area/radial geometry,
financial series, force layouts, geography, and chart conveniences remain deferred.

## Existing behavior to preserve

Current `@crc/viz` exports `Scale`, `useScale`, `ScaleAdjust`, `Axis`, and
`LineSeries`. Scales are linear immutable snapshots in core-owned signals;
providers resolve local allocation, restore lexical scope, and reject lookup
across rendering-instance/managed-Layer boundaries. Axes reserve no gutters;
series do not implicitly clip, sort, coerce, or infer domains.

Both series reuse those contracts. They add no scale family, domain registration,
layout frame, implicit selection state, or changes to current linear ticks.
Existing public props and behavior remain valid.

## PointSeries authoring

```tsx
<Scale id="x" type="linear" domain={[0, 100]} range="width">
  <Scale id="y" type="linear" domain={[0, 100]} range="height" reverse>
    <LineSeries data={samples} x="x" y="y" xScale="x" yScale="y" />
    <PointSeries
      data={samples}
      x="x"
      y="y"
      xScale="x"
      yScale="y"
      style={{ radius: 3, fill: "#2563eb" }}
    />
  </Scale>
</Scale>
```

Equivalent non-JSX authoring uses `createElement(PointSeries, props)` with the
same props. A scatter plot simply omits LineSeries. Multiple point series remain
multiple keyed components rather than a grouping grammar.

Approved declarations (core imports and existing viz types omitted):

```ts
export type PointAccessor<D> = LineAccessor<D>;

export interface PointMarkStyle {
  readonly radius?: number;
  readonly fill?: FillStyle;
  readonly stroke?: StrokeStyle;
  readonly strokeWidth?: number;
  readonly opacity?: number;
}

export interface PointSeriesStyle extends PointMarkStyle {
  readonly cursor?: string;
}

export type PointStyleResolver<D> = (
  datum: D,
  index: number,
  data: readonly D[],
) => Readonly<PointMarkStyle>;

export interface PointSeriesProps<D>
  extends CRCEventHandlers, CRCEventParticipationOptions {
  readonly data: SignalValue<readonly D[]>;
  readonly x: PointAccessor<D>;
  readonly y: PointAccessor<D>;
  readonly xScale: ScaleId;
  readonly yScale: ScaleId;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  readonly style?: SignalValue<
    SignalStyle<PointSeriesStyle> | PointStyleResolver<D>
  >;
}
```

`radius` measures logical pixel radius, not diameter or encoded area. Start with
circles only. Additional batched symbols and area encoding need a later
contract; applications can derive a radius explicitly or use PlotSeries for
custom elements meanwhile. Defaults are
radius 3, fill `#2563eb`, no stroke, strokeWidth 1, opacity 1, no cursor.
Radius/stroke width must be finite and nonnegative; opacity must be in [0, 1].
Core paint validation applies to fill and stroke. Zero radius emits no mark and
no hit geometry. Zero opacity retains geometry, following ordinary CRC behavior.

Resolve the outer data once in the receiving series. Visit rows in source order;
evaluate `defined` first and skip false rows without evaluating coordinates or
style. Evaluate each coordinate once. Null, undefined, nonnumeric, or nonfinite
coordinates skip the mark, matching the line's invalid-coordinate policy.
Finite mapping overflow throws. Resolve a datum style only for a valid point.
Accessor and style exceptions follow normal fail-closed rendering.

A shared object accepts the existing whole-style/shallow-field signal rules.
A style callback is opaque and invoked once per valid row; its returned object
uses defaults for omitted fields, with no implicit signal unwrapping. Explicit
signal reads inside it belong to the receiving series. This preserves the
foundation's distinction between a shared reactive style and datum computation.
The callback controls mark paint only; per-datum cursors are deferred because
this slice deliberately has one series target. Unknown fields reject.

## PointSeries batching, paint, and interaction

One mounted series owns one geometry/paint program and at most one logical
target. No component, hook, subscription, or event record is created per datum.
Scratch geometry may scale with valid rows; node/consumer/target counts must not.

Source order governs paint. Each point paints fill then stroke before the next
point. Overlapping translucent circles must look like that ordered sequence.
Combining circles into a single compound fill, regrouping rows by color, or
painting all fills before all strokes can change the result and is forbidden
unless equivalence is established. “Batched” promises bounded component/event
overhead, not one Canvas paint call for every possible style.

The series target covers the union of its actual filled disks and stroked rings.
It does not fill the whole plot, claim space between points, or turn stroke-only
circles into filled hit targets. Heterogeneous stroke widths and fill presence
must preserve that union exactly; one compound path with one guessed stroke
width is insufficient. Use existing core path target mechanisms and a bounded
series-owned geometry representation; do not introduce a second dispatcher.
`pointerEvents="none"` removes the series target. All rows share its ordinary
event identity, capture, propagation, and cursor.

Nearest lookup is a separate question from hit testing: the nearest center may
not be the topmost painted mark and may lie outside its painted radius. The
helper result is never presented as a core event target. Per-datum hover events,
focus targets, lazy `event.nearestDatum()`, and enlarged point hit radii are
deferred. Authors can put a handler on explicit plot geometry for inspection
across empty space, as in the accepted line example.

## PlotSeries: custom CRC elements at data coordinates

`PlotSeries` maps each eligible datum through the same named x/y scales, then
renders author-supplied CRC nodes with local origin `(0, 0)` at that point.
It can return a shape, text, an image, a reusable component, or a composition
of elements. It owns placement; the returned elements own their paint, geometry,
styles, state, and event behavior. There is no default mark when `render` is
omitted: use PointSeries for default dots.

```tsx
<PlotSeries
  data={observations}
  x="time"
  y="value"
  xScale="x"
  yScale="y"
  keyBy="id"
  render={(datum) => (
    <Group>
      <Rectangle
        style={{ x: -5, y: -5, width: 10, height: 10, fill: datum.color }}
        onClick={() => selected.set(datum.id)}
      />
      <Text
        pointerEvents="none"
        style={{ x: 8, y: 0, fill: "#334155", textBaseline: "middle" }}
      >
        {datum.label}
      </Text>
    </Group>
  )}
/>
```

`createElement(PlotSeries, { data, x, y, xScale, yScale, keyBy, render })`
is the equivalent construction. The callback returns ordinary CRC nodes;
there is no function-child protocol or special element vocabulary.

```ts
export type PlotKeyAccessor<D> =
  | { [K in keyof D]-?: D[K] extends string | number ? K : never }[keyof D]
  | ((datum: D, index: number, data: readonly D[]) => string | number);

export interface PlotSeriesProps<D> extends CRCEventHandlers {
  readonly data: SignalValue<readonly D[]>;
  readonly x: PointAccessor<D>;
  readonly y: PointAccessor<D>;
  readonly xScale: ScaleId;
  readonly yScale: ScaleId;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  readonly keyBy?: PlotKeyAccessor<D>;
  readonly render: (datum: D, index: number, data: readonly D[]) => CRCNode;
}
```

### Placement and eligibility

Use exactly the PointSeries coordinate/defined rules. Resolve the data once and
read each scale snapshot once during PlotSeries evaluation. For valid rows,
map x/y once and create a translated, keyed row subtree in source order. No
sorting, clipping, culling, collision avoidance, domain inference, or automatic
centering is implied. A circle centered at zero is centered on the point;
a rectangle needs explicit negative half-width/height offsets if desired.
Finite coordinates outside the domain still render via scale extrapolation.

Translate only; do not scale a mark's dimensions by domain units. This matches
ScaleAdjust. The translation inherits the incoming plot allocation, without
allocating a per-point box or subtracting the point position from available
width/height. Percentage sizes therefore use that inherited allocation until
an author establishes a new allocated container inside the mark. PlotSeries has
no intrinsic measurement and does not reserve gutters or label space.

Invoke `render` once per eligible row evaluation, inside a stable internal row
component under that row's translation. It is synchronous: supported CRCNode
forms, including arrays/fragments and null, follow core's recursive protocol;
promises and foreign elements receive ordinary core diagnostics. Returning null
paints nothing but preserves the row wrapper while the row remains eligible.
Invalid or undefined rows never call `render` and have no mounted row subtree.

### Identity, hooks, and signal ownership

`keyBy` supplies the row wrapper's key. Normalize string/number keys by core's
existing rules; reject invalid key values and duplicate normalized keys among
eligible rows. Evaluate the key accessor once per eligible row. When omitted,
use the original source index as the key, not the compacted valid-row index.
This is convenient for fixed-order data, but insertion/reorder can associate
existing state with another datum. Recommend `keyBy` for mutable datasets.

A stable key preserves the row wrapper and same-type/key descendants across
reorder, data replacement, and scale/domain/size changes, within the same
PlotSeries parent. Removing a row or making it invalid unmounts it; reintroducing
it creates fresh state. Returned keys identify siblings inside that row, not
the row in the dataset. Changing the returned component type follows ordinary
remount rules. Changing callback identity alone does not remount every row.

The callback constructs nodes; it is not itself a hook-bearing component.
For hooks, return `<CustomMark datum={datum} />` and call hooks inside CustomMark.
Do not call a component function directly. Explicit signal reads in the callback
belong to the internal row receiver that invokes it; reads inside returned
components belong to those components. Data/coordinate/defined/key accessor
reads belong to PlotSeries. Hook counts never depend on dataset length in the
series owner. Signal writes during any render remain forbidden.

### Events, styling, and cost

PlotSeries is structural: series handler props register propagation listeners,
without an independent hit target. Returned drawing elements participate in
ordinary CRC targeting, source paint order, clipping, cursor, capture, and
opt-in focus/navigation. Handlers on those elements can close over their datum;
no enriched event or datum registry is necessary. Later overlapping rows paint
and target above earlier rows according to core rules.

There is no series-level `pointerEvents` or shared mark `style` in this initial
API: set those on the returned elements. Structural `pointerEvents="none"`
must not be invented as a recursive disable switch. A custom element may be
decorative with `pointerEvents="none"`, or may supply its own explicit target.
Filters and opacity on an authored Group use existing combined-subtree semantics.

Each row pays for its ordinary subtree, hooks, and event targets. This is the
explicit full-customization path, with O(n) row components plus authored nodes.
PointSeries retains its bounded-node batched-dot path. Large visualizations can
combine a batched PointSeries with a PlotSeries containing only selected or
annotated rows. Do not implicitly sample, virtualize, or replace custom elements
with a batch renderer.

Ordinary backend constraints remain: custom nodes must be valid at their
location; standalone WebGL meshes are not legal Canvas marks. A nested Layer
retains the existing scale-scope boundary, so child lookups cannot silently
reach providers outside its rendering instance.

## Pure inspection helpers

Lock the approved one-dimensional responsibility and add an explicitly named
two-dimensional operation. Approved signatures:

```ts
export function nearestDomainValue(
  values: readonly number[],
  rangeValue: number,
  scale: ResolvedLinearScale,
): number | undefined;

export interface NearestPointOptions<D> {
  readonly x: PointAccessor<D>;
  readonly y: PointAccessor<D>;
  readonly xScale: ResolvedLinearScale;
  readonly yScale: ResolvedLinearScale;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  readonly maxDistance?: number;
}

export interface NearestPoint<D> {
  readonly datum: D;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly distance: number;
}

export function nearestPoint<D>(
  data: readonly D[],
  point: Readonly<{ x: number; y: number }>,
  options: NearestPointOptions<D>,
): NearestPoint<D> | undefined;
```

Both are synchronous pure array scans: O(n) time and O(1) working storage beyond
the returned record. They install no observers, caches, hooks, or event handlers;
no nearest work runs unless called. Arrays need not be sorted. Inputs are not
mutated. Empty or entirely invalid inputs return undefined.

`nearestDomainValue` skips nonfinite/nonnumeric values and minimizes absolute
distance between `scale.map(value)` and the supplied range coordinate. Return
the original numeric domain value. Equal distances choose the earliest source
index. This does not rely on inversion and works for collapsed ranges.

`nearestPoint` uses the same coordinate/defined eligibility as both series and
minimizes Euclidean distance between mapped centers and the input point, using
overflow-safe distance arithmetic. Exact ties choose the earliest source index.
Returned x/y are mapped local coordinates, index is the original source index,
and datum is the original reference. It does not inspect paint, opacity, radius,
or clips; select the candidate dataset explicitly when those should limit search.
For PlotSeries it finds the plotted anchor, not a custom element's outline,
visual center, or target. It neither invokes `render` nor inspects its nodes;
rows whose renderer returns null remain eligible unless filtered explicitly.
`maxDistance` is an inclusive finite nonnegative local-distance limit; omission
means unlimited. Invalid query coordinates/options or mapping overflow throw.

These helpers accept plain arrays and resolved snapshots. Callers explicitly
read signals at their intended use site. A handler should use data and scale
snapshots from the same successful render when inspecting displayed geometry,
rather than mixing newly written data with an older displayed frame.

Coordinate conversion is explicit. CRC events expose root-logical x/y; the
helpers consume the scales' shared local frame. For a translation-only plot,
subtract the known plot origin. For transformed plots, apply the inverse of the
known application transform before querying. Do not infer an origin from
`scale.frame`, whose x/y are zero, or multiply by backing pixel density.
Nonuniform transforms mean local nearest and screen-space nearest can differ;
this helper promises local distance only. A general event-to-local conversion
API would be core work and is not silently added here.

## Approved extension: function-based hover queries

Approved in the subsequent design conversation. This section adds planned work;
it is not a claim that these APIs already exist. It supersedes the conversational
`PointCallout`, `HoverData target`, string-valued `sampling`, and immutable query
AST proposals. Existing `nearestPoint` and `nearestDomainValue` remain unchanged.

Separate three responsibilities: application events write inspection signals;
`HoverData` evaluates a synchronous query and renders its result; `HoverCard`
positions and paints an optional readable card. No series discovery, registration,
selection store, event loop, or required Chart container is added. One query can
inspect any number of datasets, irrespective of which drawing components use them.

### Query receiver and render callback

```ts
export interface HoverQueryContext {
  scale(id: ScaleId): ResolvedLinearScale;
}
export type HoverQuery<T> = (context: HoverQueryContext) => T | undefined;
export interface HoverDataProps<T> {
  readonly query: HoverQuery<T>;
  readonly children: (result: T | undefined) => CRCNode;
}
export function HoverData<T>(props: HoverDataProps<T>): CRCNode;
```

`HoverData` invokes query once per receiving component evaluation, then invokes
children once, including when the result is undefined. An empty query result does
not dictate UI: the callback can return null, an empty-state node, or other CRC
content. Result types, including arbitrary custom records and discriminated
unions, flow into children without casts. Equivalent non-JSX authoring passes
`children` explicitly in `createElement(HoverData, { query, children })`.
This function-child input belongs to HoverData only; it does not change CRCNode
or PlotSeries's existing render prop.

Context scale lookup reads the current resolved snapshot under the receiving
component's normal lexical scale scope. Cache each requested snapshot within
that query invocation; preserve missing-provider and cross-Layer/root diagnostics.
The context is invocation-local, not a retained scale service. Queries are ordinary
functions, not branded descriptors. Helper factories return such functions and
perform no subscription, resource acquisition, or data scanning at construction.

Queries and render callbacks are synchronous render-time calculations: no hooks,
writes, promises, resources, or async work. Hooks belong in returned components.
Explicit signal reads in query and children are owned by HoverData; reads inside
returned components retain their own receiver. Branch changes replace dependencies;
removal, failure, and disposal release them. Normal render write guards apply.
Do not use function identity as subtree identity: replacing a query or callback
preserves same-type/key returned components under the same parent. Returning no
nodes still unmounts prior descendants normally. Render callback output follows
normal CRCNode validation; async query results get an actionable diagnostic.

### Series inputs and function-producing helpers

`defineSeries<D>({ data, x, y, defined? }): HoverSeries<D>` is a small immutable,
unbranded descriptor factory for readonly data/accessors. `data` accepts
`SignalValue<readonly D[]>`; accessors reuse PointAccessor and defined's existing
signature. It creates no copy of the dataset, index, observer, or runtime owner.
Applications may use structurally compatible plain descriptors instead. Data
signals are read by the query, once per series per invocation; datum records stay
opaque. Explicit accessor signal reads belong to that same query receiver.

Helper option objects are ordinary configuration, not query ASTs:

- `closestPoint({ series, position, xScale, yScale, maxDistance? })` returns a
  HoverQuery. `series` is a readonly record of named HoverSeries descriptors;
  `position` is a plain/signal local `{x,y}` or null. It searches eligible recorded
  points across the record in Object.keys order and source order, minimizing
  mapped Euclidean distance. Exact ties retain the first candidate. maxDistance
  is inclusive, finite, nonnegative, and in local plot pixels; omitted is unlimited.
  Result: `{ series, datum, index, x, y, anchor, distance }`, with domain x/y,
  mapped local anchor, original datum/index, and a literal series key. Heterogeneous
  series produce a discriminated union associating each key with its datum type.
- `closestX({ series, x, xScale, yScale, maxDelta? })` returns a HoverQuery for one
  descriptor. `x` is a plain/signal domain number or null. It minimizes absolute
  domain-x distance, independent of cursor y; unsorted data is allowed. Earliest
  source row wins ties. Inclusive finite nonnegative maxDelta uses domain units;
  omission is unlimited. Result: `{ datum, index, x, y, anchor, delta }`, preserving
  the chosen observation and its actual x rather than the queried x.
- `interpolateX({ series, x, xScale, yScale, interpolation, maxGap?, duplicateX? })`
  returns a HoverQuery for one descriptor. `interpolation` is an ordinary
  `(beforeY: number, afterY: number, fraction: number) => number` function;
  `linearInterpolation()` returns the standard linear function. Custom rules use
  the same contract. `duplicateX` is `"error" | "first" | "last"`, default error;
  first/last explicitly chooses by source order among equal-x rows. maxGap is an
  inclusive finite nonnegative domain interval limit; omission is unlimited.

Nearest helpers use the existing defined/coordinate eligibility and never invoke
styles or mark renderers. Null inspection inputs and empty/all-invalid data return
undefined. Nonfinite query inputs, invalid options, mapping/distance overflow, and
nonfinite interpolator output throw. No hidden global cache or persistent index;
nearest scans remain O(total rows). Scale IDs initially share one local frame and
one x/y pair per query; alternate axes can be composed as separate query functions.

Interpolation requires finite source x values in nondecreasing order and does not
sort or mutate the source. A decreasing finite x throws. Rows with defined=false
or missing/nonfinite x/y separate segments; they must not be removed to fabricate
a connecting interval. Duplicate policy applies to equal-x runs within each
segment; distinct segments never become one segment. Exact matches return the
first eligible matching segment in source order after duplicate resolution.
No extrapolation and no crossing segment gaps. A query inside a valid bracketing
interval returns undefined if the interval exceeds maxGap. Exact recorded matches
remain available regardless of maxGap. Validate duplicate/order policy before
returning an early exact match, so the result does not depend on scan shortcuts.

```ts
export type HoverSample<D> =
  | { kind: "exact"; x: number; y: number; datum: D;
      index: number; anchor: Readonly<{ x: number; y: number }> }
  | { kind: "interpolated"; x: number; y: number; before: D; after: D;
      beforeIndex: number; afterIndex: number; fraction: number;
      anchor: Readonly<{ x: number; y: number }> };
```

For interpolation, fraction is `(x - beforeX) / (afterX - beforeX)`, evaluated
with overflow checks; y is evaluated in data space before mapping. An estimate
never invents an original datum. Preserve endpoint references and source indices.
This estimates the chosen data function, not a promise of lying on a differently
curved/styled rendered path. The first supplied interpolation function is linear;
additional built-in curve families are deferred.

### Wiring one result, independent results, and shared-x estimates

The following uses proposed exports inside existing Scale providers. Application
handlers write `cursor` after explicitly converting root-logical event coordinates
to the plot's local frame. For translation-only plots subtract the known plot
origin; no new Plot, PlotPointer, InspectionLine, or automatic inverse-transform
API is approved by the earlier illustrative pseudocode.

```tsx
const nearestAcrossLines = closestPoint({
  series: { temperature, forecast }, position: cursor,
  xScale: "time", yScale: "temperature", maxDistance: 24,
});
const temperatureAtTime = interpolateX({
  series: temperature, x: inspectedTime,
  xScale: "time", yScale: "temperature",
  interpolation: linearInterpolation(), maxGap: 2 * HOUR,
});
const forecastAtTime = interpolateX({
  series: forecast, x: inspectedTime,
  xScale: "time", yScale: "temperature",
  interpolation: linearInterpolation(), maxGap: 2 * HOUR,
});

// One original observation across both lines.
<HoverData query={nearestAcrossLines}>
  {(hit) => hit && <Reading hit={hit} />}
</HoverData>

// Two independent results: use two HoverData receivers, each with closestX
// for its series and the same inspectedTime signal. Actual timestamps may differ.

// Two estimates or exact observations at one time, with a combined readout.
<HoverData query={(context) => ({
  temperature: temperatureAtTime(context),
  forecast: forecastAtTime(context),
})}>
  {(result) => result && <Comparison {...result} />}
</HoverData>
```

These snippets illustrate ordinary component composition, not new automatic
interaction. The implementation lesson must show all three complete wirings with
public imports and actual event-coordinate conversion (no placeholder components).
Convert cursor x to domain time with the current x snapshot's invert operation;
if inversion is unavailable for a collapsed range, clear inspection. A draggable
line writes the same inspectedTime signal using ordinary pointer capture/events.
Render highlights through Group/Circle and the vertical guide through Line. Render
hover output after marks. A custom query can return any shape and close over its
own data/signals, with no factory or registration requirement.

### HoverCard: readable placement without covering its anchor

HoverCard is independent of query resolution and drawing series. Proposed inputs:
`anchor: SignalValue<Readonly<{x:number;y:number}>>`, `anchorRadius?: SignalValue<number>`
(default 0), `gap?: SignalValue<number>` (default 8),
`placement?: "auto" | "above" | "below" | "right" | "left"` (default auto),
`bounds?: SignalValue<Readonly<{x:number;y:number;width:number;height:number}>>`,
`style`, and ordinary CRCNode children. Bounds default to the incoming allocation's
local `[0,width] × [0,height]` rectangle. Anchor/bounds are in that same local
frame: mount the card at plot origin, not inside an already-translated mark.

Use a closed core-derived style with declared width/height, padding, fill, stroke,
strokeWidth, cornerRadius, and opacity. Width and height are required finite resolved
sizes; no implicit text measurement. Defaults: padding 10, cornerRadius 7,
fill `rgba(255,255,255,0.92)`, stroke `rgba(98,117,139,0.35)`, strokeWidth 1,
opacity 1. Core box sizing, percentage resolution, and content allocation rules
apply. Do not allow arbitrary transforms/filters on the card itself to silently
invalidate the placement guarantee. Children can draw freely, but overflowing child
paint is the author's responsibility; the guarantee covers the declared card box
including half its border stroke, not arbitrary descendant/filter overflow.

Try above, below, right, left in that order for auto. A preferred side is tried
first, followed by the remaining auto order. Center along a side, then slide only
tangentially to fit bounds. Never clamp the perpendicular offset toward the anchor.
Choose the first fitting candidate. If no side fits, use the first candidate with
tangential adjustment and allow overflow; do not cover the point or scale content
to force a fit. Parent Clip boundaries still apply. Zero/tiny allocations and
oversized cards do not weaken exclusion. Anchor coordinates must be finite; radius,
gap, bounds dimensions, and resolved card dimensions must be finite/nonnegative.

Every placement must keep the card's outer box outside the anchor's protected
radius plus gap, including when the anchor lies at a boundary or outside bounds.
This is conservative circle exclusion, independent of the painted point shape.
Rectangular protected marks and automatic multi-card collision avoidance are
future extensions; multiple cards can choose different preferred sides explicitly.

The built-in background is pointerEvents=none. CRC structural containers do not
recursively disable descendant targets: authored Text/shape decorations must also
use pointerEvents=none, as the documented card examples will do. Interactive
children retain normal explicitly authored core targets; do not invent a recursive
pointer flag or second hit-testing layer. HoverData/HoverCard own no pointer state.
The card paints at its ordinary source position; authors put it after marks.

### Extension evidence and responsive boundary

First extend the penguin example with a function query and HoverCard, proving that
cards at all four edges never cover the selected circle, including narrow plots.
Then add a focused real-data two-line lesson showing one nearest overall result,
two nearest recorded results, and two exact/interpolated results at shared time,
plus a draggable guide and a custom combined query. Both need deterministic public
lab adapters and focused tests before production implementation. Preserve the
existing accepted CO₂ lesson unless its modification is separately required.

HoverData uses core receiver ownership and no style evaluator. HoverCard must use
the actual core declared-box/style boundary; re-evaluate bounds and placement on
allocation or signal changes. Use core's published responsive types/evaluator only
when implemented, never copy it into viz. Query factories do not add responsiveness,
listeners, animation frames, or a second coordinate system. Surface all new APIs
consistently in root/types, packed consumers, Studio declarations, source/built
browser modes, and public docs; design approval alone is not implementation evidence.

## Responsive styling integration

The [concurrent responsive style specification](2026-09-28-responsive-style-queries-design.md)
is proposed, not shipped. At inspection it covers containing-allocation width
and height, ordered `style.when` patches, and receiver-owned signal reads. Its
primitive evaluator selects patches before normalization; transform/density
changes do not change the query basis. Conditional structure, data, handlers,
and Axis tickCount remain ordinary component logic.

This leaves coordinates, scale mathematics, lookup, and event semantics intact.
Responsive styles may change shared point radius/paint, axis font, line width,
and surrounding layout. They cannot change point data or lookup distance limits.
Smaller available width does not imply touch input.

There is a real integration seam: current Axis and LineSeries are plain
functions with manual style resolution. Widening their types to accept `when`
would not make them evaluate it. Do not advertise support until the shared core
evaluator is actually used and tested at the receiving viz boundary.

Recommended implementation shape is a viz-owned primitive style boundary using
core's normalization/provision path, with ordinary component code for scale and
data access. It must resolve shared styles once per series occurrence, before
datum geometry, and preserve the incoming allocation. Never query each mark's
radius/bounds, forward unresolved rules to individual generated paths, or copy
core's evaluator into viz. Preserve receiver ownership when forwarding resolved
paint. Prototype this boundary with a focused public test before a broad rewrite.

When core support lands, shared object styles can accept its published responsive
style type. Style callbacks remain opaque; returned objects contain resolved
mark values only, with neither `when` nor implicit nested signals. A callback
needing responsive values can close over values derived in ordinary component
code from `useLayoutBox()`. Adding combined base-style/patch callback machinery
is unnecessary for this slice.

Points and pure inspection can ship independently of responsive styling using
today's shared-style contract. If core lands first, adopt its exact exports and
one tested boundary before claiming responsive viz support. This is an explicit
integration milestone, not a hidden prerequisite or a second responsive API.

PlotSeries adds no style resolver: returned elements use core's style inputs
directly. Once responsive styles land, their `style.when` patches query the
inherited plot allocation, unless the mark explicitly establishes a smaller
container. Moving a point does not change its query basis. A renderer can return
different structures using ordinary component logic; resulting identity changes
follow the same rules as any CRC subtree. Responsive styling support inside
custom marks must not be confused with support on PointSeries's own style input.

## First runnable slice and evidence

Proposed new learning route:
`http://localhost:5173/#/examples/composition/viz-points-and-inspection`.
The first slice is implemented; its actual preview is on port 5180 (see the plan). Keep the accepted CO₂ lesson unchanged.

The original slice proposed scatter and line-plus-point panels. Accepted feedback
replaced these with two views of a credited static Palmer Penguins snapshot:
344 records, 342 complete points, flipper length versus body mass, with no line
joining independent observations. Use two independently allocated plots. Include shared and
datum-resolved styles, custom PlotSeries markers with labels, an ordinary selection signal, a visible readout, pointer
inspection, click/tap selection, and simple previous/next selection controls.
Controls are application composition, not a new library selection API. They do
not imply a Canvas accessibility tree. PlotSeries marks may opt into existing
core focus/navigation; PointSeries does not create a focus target per dot.

Before production code, add one failing public-API lab test proving mapped
circle centers, missing-row omission, inspection index, and selection update.
The first runnable milestone also needs focused checks for overlapping alpha,
source-order paint, ordinary event propagation, source updates, resize alignment,
and teardown. Use semantic geometry and counters first; add narrow pixel evidence
where overlap compositing specifically needs it. A constant-style large dataset
must retain constant component/target counts; do not claim a throughput target
without measuring it.

For PlotSeries add focused public evidence of custom mark placement and datum
handlers, a stateful returned component with keyed reorder, and exact cleanup
after removal. Its node count may grow with rows; assert that its resource count
returns to baseline rather than applying PointSeries's constant-count promise.
Prove the line/dot/custom overlay before broader hardening. Once core responsive
styles are available, verify that two translated marks in one plot query the
same plot dimensions and that an explicitly allocated inner container changes
only its descendants' query basis.

Stop at **slice ready for feedback** with the exact running route and focused
results. After experiential acceptance, harden invalid inputs, tie cases,
zero/collapsed allocations, transformed/clipped interaction, signal edge changes,
callback failures, source replacement, disposal, independent roots, Layer scope
diagnostics, and JSX/createElement equivalence. Then align root declarations,
packed Bundler/NodeNext consumers, source/built browser modes, Studio editor
types, and public documentation, and run proportional final verification and
the repository trust gate. Design-time inspection is not test evidence.

## Review boundary

The approved scope includes batched dots, custom plotted CRC subtrees, pure
inspection, and the function-based hover-query/card extension above. It specifies radius rather than area,
one PointSeries target versus ordinary custom-element targets, keyed row
identity, source-order compositing, local nearest-anchor distance, opaque datum
style callbacks, and core-owned responsive evaluation.

The user approved this written design and requested the
[implementation plan](../plans/2026-09-28-data-visualization-points-and-inspection.md).
Execution was subsequently approved in an isolated worktree; see the plan for
progress and the required feedback checkpoint.
