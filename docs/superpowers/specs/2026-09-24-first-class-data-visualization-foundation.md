# First-class data visualization foundation

> **Historical status: Desktop slice accepted and hardened; unrelated visual baseline gap recorded.**

> **Status: FIRST-SLICE SPECIFICATION AND EXECUTION PLAN APPROVED.**
> The 2026-09-24 approved foundation is preserved below. The 2026-09-28
> first-slice contract completes the decisions needed for a responsive line
> example, with an explicit prerequisite on the parallel signals work.
> Execution is approved. The shared signals prerequisites passed after merge
> `24c57d7`; the desktop slice and brush revision are accepted. Mobile presentation is
> explicitly deferred; general responsive style queries are separate exploratory work.

Date: 2026-09-24; first-slice proposal: 2026-09-28

## First slice specification — proposed 2026-09-28

This section is the implementation-ready contract approved in conversation. It
narrows delivery, not the approved longer-term direction recorded below. Where
an older section says a first-slice decision is open, this section supplies it;
other open decisions remain deferred. Approval of this specification permits
writing an implementation plan, not executing it. Execution needs separate
approval, as requested.

### Repository audit and prerequisite gate

Read against checkout `4d4f0df` on 2026-09-28; the working tree was clean at
inspection. This is an inspection record, not a fresh runtime test result.
Current code, not the parallel thread's plan checkboxes, determines readiness.

- `packages/core/src/index.ts` exports `signal`, `computed`, `useSignal`,
  `useMemo`, and `useWhenChanged`. It does not export `SignalValue`,
  `SignalStyle`, `resolveSignalValue`, or `useComputed`.
- `useLayoutBox()` returns the current readonly allocation snapshot. It is not
  a signal. Layout reflow supplies a new snapshot through ordinary traversal.
- Core rejects signal writes during render, including equality no-ops.
- The existing official-package seam supplies owned hook slots and
  `setCurrentComponentAfterRender`; the physics world is an existing scoped
  provider precedent. No application import of private source paths is needed.
- Packages use ESM declarations/build output, a matching core peer dependency,
  and the single core JSX runtime. Public consumers, source/built browser
  aliases, packed output, and Studio declarations must all agree.

**Historical prerequisite at the initial inspection:**

1. The signal-input exports and semantics from Tasks 5–6 of the parallel plan:
   `SignalValue`, `SignalStyle`, `resolveSignalValue`, declared shallow input
   resolution, and layout handling of declared signal-valued style positions.
2. Transactional `useComputed` from Task 7: stable signal identity, dependency
   array refresh, same-transaction provisional reads, success-only publication,
   rollback, and equality barriers.

The second requirement matters even if callers use explicit `.get()` props:
plain props and the non-signal allocation must refresh the same resolved-scale
signal without a render-time write. Standalone `computed` plus a mutable ref
would leave its cache stale; replacing the signal on every resize would violate
stable `useScale` identity. A delayed effect would add a stale frame. None is
an acceptable substitute.

Reinspect these exports and run their focused executable tests before any viz
production work. Do not implement these hooks, input resolution, a graph, or a
transaction mechanism in `@crc/viz`. Do not edit the other thread's work. If
those capabilities remain absent or differ materially from the approved
contract, stop at the named dependency and report it. The complete hooks
migration and its aggregate gate are not prerequisites merely by association.

### Execution audit after signals merge

At `24c57d7`, public `SignalValue`, `resolveSignalValue`, and transactional
`useComputed` are available. The focused core hook/input suites passed (20 tests).
`SignalStyle<S>` is the shared official-package type from `@crc/core/internal`,
not a root export; whole signal-valued styles use `SignalValue<SignalStyle<S>>`.
The shared resolver unwraps one level. Viz validates its declared resolved
values rather than introducing recursive resolution or a second signal graph.
This supersedes the historical blocked status above.

### Delivery boundary

The slice exports `Scale`, `useScale`, `ScaleAdjust`, `Axis`, `LineSeries`, and
the types below from `@crc/viz`. It implements **linear scales only**, including
numeric elapsed-time x coordinates. Actual calendar time/UTC scales and domain
helpers are deferred. This avoids choosing calendar tick/format semantics to
prove an allocation and signal architecture.

One responsive learning example and its separate deterministic lab prove two
independently allocated plot panels, nested x/y scales, gaps, source updates,
ordinary CRC pointer interaction, and custom composition. Both use supported
package imports. There is no chart container, per-datum component tree,
visualization runtime dependency, implicit clipping, or new event API.

### Initial scale types

All imported types in the declarations below come from `@crc/core`. These are
public contract sketches; implementation declarations must preserve the same
constraints and inference.

```ts
export type ScaleId = string | symbol;
export type LinearDomain = readonly [number, number];
export type ScaleRange = "width" | "height" | readonly [number, number];
export type ScaleLayoutStyle = Pick<BoxStyle, "width" | "height"> &
  LayoutItemStyle;

export interface LinearScaleProps {
  readonly id: ScaleId;
  readonly type: "linear";
  readonly domain: SignalValue<LinearDomain>;
  readonly range: SignalValue<ScaleRange>;
  readonly reverse?: SignalValue<boolean>;
  readonly style?: SignalValue<SignalStyle<ScaleLayoutStyle>>;
  readonly children?: CRCNode;
}
export type ScaleProps = LinearScaleProps;

export interface ResolvedLinearScale {
  readonly type: "linear";
  readonly domain: LinearDomain;
  readonly range: readonly [number, number];
  readonly frame: Readonly<LayoutBox>;
  map(value: number): number;
  invert(pixel: number): number;
  ticks(count?: number): readonly number[];
}
export type ResolvedScale = ResolvedLinearScale;
export declare function useScale(id: ScaleId): Signal<ResolvedScale>;
```

`ScaleProps` is deliberately a one-member discriminated union today. Future
families extend it; it does not advertise options for unimplemented families.
IDs, type discriminants, and structural children are ordinary values, not
signal input positions in this slice. ID must be a nonempty string or a symbol.
An ID change affects lookup on that render; signal identity follows the mounted
provider hook slot. Remounting creates a new signal. A `useScale` caller gets
the nearest provider's exact readonly signal; selecting a different provider
may therefore return a different signal.

A domain has exactly two finite, unequal endpoints; descending is valid.
A numeric range has exactly two finite endpoints; equal endpoints are valid for
collapsed allocations. `reverse` defaults false and swaps the resolved range
endpoints once. Mapping and inversion are affine and extrapolate; no clamp,
nice, unknown-value substitution, implicit domain, or mutation is supplied.
`map` rejects nonfinite input or output. `invert` rejects nonfinite input/output
and a zero-span range with an actionable error. Domain/range tuples and the
resolved object/frame are readonly immutable snapshots, copied from inputs.

`ticks(count = 5)` requires an integer from 2 through 100 and returns exactly
that many evenly spaced domain values, including both endpoints, in domain
order. It does not promise “nice” decimal ticks. Nonfinite derived arithmetic
rejects. There is no formatter method in the initial scale interface; formatting
belongs to the consuming Axis. No date, bandwidth, percentage endpoint, or
interpolation methods/options are exposed prematurely.

### Allocation and signal derivation

`Scale` receives the finite local allocation supplied by CRC. It creates no
box, translation, padding, clip, paint, or hit target. Its optional layout style
only supplies direct-child placement/sizing information to a layout parent.
It has no intrinsic measurement. When used directly under a layout that needs
sizes, declare sizes on the Scale or on a wrapper that contains it. A plain
nested Scale passes the same allocation to its children.

`range="width"` resolves to `[0, box.width]`; `"height"` to `[0, box.height]`.
The frame is `{ x: 0, y: 0, width: box.width, height: box.height }` for all range
forms, including numeric tuples. Zero dimensions are valid; negative or
nonfinite dimensions reject. The root's logical viewport is a valid allocation,
but the example must prove smaller independent layout allocations. Density and
ancestor transforms never enter scale arithmetic.

On each provider evaluation, call `useLayoutBox()` outside any computed
formula. Supply domain/range/reverse prop identities and the captured numeric
width/height as explicit dependencies to **core's** `useComputed`. Resolve the
three declared inputs with **core's** `resolveSignalValue` inside the formula.
Thus source signals are computed dependencies; allocation and plain prop
changes refresh the formula transactionally. A formula never calls hooks or
reads ambient mutable layout state.

Resolved-scale equality compares type, both domain/range endpoints, and frame
width/height numerically with `Object.is`; it does not compare fresh method
identities. Equal values cause no downstream invalidation. Readers call `.get()`
in their own evaluation. Passing the signal alone subscribes no component.
Resizing renders descendants with the current candidate in that same root
transaction. Committed changes notify other consumers only under core's
transaction/scheduler rules; this does not promise zero follow-up work for
consumers outside that transaction.

### Scope, ownership, and failure

Use a private linked provider stack and the existing after-descendants restore
hook from `@crc/core/internal`, with immediate restoration if installing cleanup
fails. Provider lookup uses strict string/symbol identity and nearest-ancestor
shadowing. No root-wide ID registry or descendant domain registration exists.
`useScale` uses an owned hook slot to enforce ordinary hook order and render-only
use. It resolves scope each evaluation rather than capturing the first provider
forever. Restore scope after success and throw; independent roots and siblings
must not leak providers into each other.

For this slice a provider and consumer must belong to the **same CRC rendering
instance**. Capture the instance's owning Canvas identity with the existing
friend getter, and reject lookup across a managed Layer boundary even on its
first traversal. Put the complete Scale subtree inside the Layer instead.
Provider scope across independently scheduled Layers is later expansion, not a
module-global stack fallback. This restriction preserves the eventual Layer
composition direction without shipping intermittently missing scopes.

The provider hook owns its computed formula generations; core owns signal
edges, validation, and teardown. Removing the tree releases its consumers and
transient scope. A retained scale signal follows core's `useComputed` rule:
readable with the last committed formula and allocation, still derived from
retained source signals, unable to schedule the removed owner. It is not a live
layout subscription after removal. Failed renders publish no candidate scale
and use core's fail-closed resource cleanup, without promising pixel rollback.

Diagnostics name the receiver and relevant prop/ID: unknown scale, missing
provider, unsupported type/range/curve, malformed domain, invalid allocation,
invalid tick count, collapsed inversion, cross-instance scope, or misuse outside
render. Signal-of-signal errors use the shared resolver. These correctness
errors throw in all builds, not only development.

### Minimum Axis contract

```ts
export interface AxisStyle {
  readonly stroke?: StrokeStyle;
  readonly strokeWidth?: number;
  readonly fill?: FillStyle;
  readonly font?: string;
  readonly opacity?: number;
}
export interface AxisProps {
  readonly scale: ScaleId;
  readonly position: "bottom" | "left";
  readonly tickCount?: SignalValue<number>;
  readonly tickFormat?: (value: number, index: number) => string;
  readonly style?: SignalValue<SignalStyle<AxisStyle>>;
}
```

Axis reads the provider signal. Bottom draws its baseline from `(r0, H)` to
`(r1, H)`; left from `(0, r0)` to `(0, r1)`, using that scale's resolved range and
frame height `H`. Bottom ticks extend 6 pixels down; left ticks 6 pixels left.
Labels start 4 pixels beyond the tick: bottom center/top aligned, left
right/middle aligned. Default style is stroke/fill `#64748b`, stroke width 1,
font `12px sans-serif`, opacity 1. All lengths are logical pixels.

Use `scale.ticks(tickCount ?? 5)`, then `map` each tick. Format with `tickFormat`
when supplied; otherwise `String(Number(value.toPrecision(6)))`, normalizing
negative zero to `0`. Callback signal reads are explicit receiver dependencies;
a callback is never auto-invoked as a reactive thunk. Invalid styles follow
core paint validation; stroke width must be finite/nonnegative, opacity 0–1.

Axis reserves no space, paints no grid/title, performs no label collision or
rotation algorithm, and infers no second scale. Authors reserve left/bottom
gutters using layout outside the plot allocation. All Axis-generated paint is
`pointerEvents="none"`. Axis accepts no event props in this slice. Reverse
changes tick locations, never which frame edge is “bottom” or “left”. Nested
transforms act on Axis paint normally; there is no inverse-transform correction
back to provider coordinates. Keep axes and series in a common local frame
unless intentionally transforming their output.

### Initial LineSeries types and geometry

```ts
export type LineCoordinate = number | null | undefined;
export type LineAccessor<D> =
  | { [K in keyof D]-?: D[K] extends LineCoordinate ? K : never }[keyof D]
  | ((datum: D, index: number, data: readonly D[]) => LineCoordinate);
export type LineCurve = "linear";
export interface LineSeriesStyle {
  readonly stroke?: StrokeStyle;
  readonly strokeWidth?: number;
  readonly opacity?: number;
  readonly cursor?: string;
  readonly lineInteractionWidth?: number;
}
export interface LineSeriesProps<D>
  extends CRCEventHandlers, CRCEventParticipationOptions {
  readonly data: SignalValue<readonly D[]>;
  readonly x: LineAccessor<D>;
  readonly y: LineAccessor<D>;
  readonly xScale: ScaleId;
  readonly yScale: ScaleId;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  readonly curve?: LineCurve;
  readonly style?: SignalValue<SignalStyle<LineSeriesStyle>>;
}
```

Accessors and `defined` are opaque synchronous callbacks; property keys include
string, number, and symbol keys with compatible value types. Normalize keys
once per accessor identity. Resolve the outer data signal once during the
series evaluation. Rows remain opaque: no recursive unwrapping, mutation,
sorting, coercion of numeric strings, or domain inference. Replace arrays, rows,
and domain/range tuples when changing their values; in-place mutation is not
an invalidation mechanism.

Visit source rows in order. If `defined` returns false, end the current run
without evaluating its coordinates. Otherwise evaluate x and y once; a null,
undefined, NaN, infinity, or runtime nonnumeric coordinate ends the run. Finite
coordinates map through their named scales; arithmetic overflow throws rather
than silently drawing incorrect geometry. Accessor/predicate exceptions follow
ordinary render failure. Empty data and runs with fewer than two points paint
nothing. Repeated coordinates remain in source order.

`curve` defaults to `"linear"`. One Path2D contains all runs, with `moveTo` at
each run start and `lineTo` thereafter. No segment crosses a gap. One core Path
paints this batch and owns its ordinary stroke hit geometry, using the same
path for paint and interaction. No components or event records per datum.
Defaults: stroke `#2563eb`, stroke width 2, opacity 1; interaction width defaults
to stroke width. Widths must be finite/nonnegative. No fill/area or closed path.

Static style means one style shared across the entire series, including all
runs. Whole styles and declared direct fields may be signal-valued through
core's `SignalStyle` contract. Resolve the whole style and each declared direct
field with core's helper during the receiving viz component evaluation; forward
resolved paint to core primitives. Apply the same rule to Axis. Do not scan
nested paint objects or invent a generic deep resolver. No style callback or
`segmentStyle` is implemented yet.
Filter/style expansion is deferred; authors may wrap a series in a core Group
with a filter. Ordinary CRC handlers and pointerEvents forward to the single
Path target. There is no event enrichment or nearest-datum helper in this slice.
Core transforms, explicit clips, target order, and teardown remain authoritative.

### Minimal ScaleAdjust extension point

```ts
type ScaleAdjustX =
  | { readonly x: SignalValue<number>; readonly xScale: ScaleId }
  | { readonly x?: never; readonly xScale?: never };
type ScaleAdjustY =
  | { readonly y: SignalValue<number>; readonly yScale: ScaleId }
  | { readonly y?: never; readonly yScale?: never };
export type ScaleAdjustProps = ScaleAdjustX &
  ScaleAdjustY & {
    readonly children?: CRCNode;
  };
```

Resolve each supplied coordinate with the shared helper and map through the
matching scale. Omitted axes translate by zero; both omitted is an identity
wrapper. Mismatched coordinate/ID pairs and nonfinite values reject. Return an
ordinary core Group translation, with no allocation or self hit geometry.
Changing supplied axes must not change hook count: internal lookup slots remain
unconditional. Children keep ordinary events. The example includes one custom
mark using this wrapper and a separate readout using `useScale`.

### Runnable evidence and stop point

Scaffold only the official package root and required workspace/build/editor
integration. Match the current sibling package version and core peer; externalize
core and its friend entry so signals and hooks use one core instance. No viz
JSX runtime, `internal` public subpath, extra package, or dependencies beyond
core are needed. Export the named types above and ordinary component functions.

The public lesson `viz-responsive-line` uses a responsive root and an explicit
Grid with two unequal fractional columns. Each panel declares its Grid placement
and contains an allocated plot with left/bottom gutters. Each plot nests x and y
Scale providers using width/height; y uses reverse. Use small deterministic
numeric elapsed-time data, one missing point, explicit domains, and straight
segments. An ordinary CRC control updates the data and domain signals. An
explicit plot background receives pointer events; line handlers demonstrate
normal bubbling. Axis decorations cannot steal input. Include a ScaleAdjust
mark and a custom useScale readout without per-datum components.

The deterministic `viz-foundation-lab` shares public composition/fixtures with
the lesson, but keeps test counters and controls out of learning metadata. It
exposes semantic readings through the existing lab harness, not a new viz
inspection API. Verify through public imports:

1. Mapping, reverse, nested shadowing, stable signal identity, and unchanged
   resolved-value equality; two local plot widths differ from the root width.
2. Resize and signal updates produce current scale ranges, mapped endpoints,
   and axis baselines/ticks; ordinary values and direct signals agree.
3. Property-key and function accessors agree; a missing row creates an actual
   gap; the series stays one batched path/target, with ordinary events.
4. One representative unknown-ID failure, failed candidate rollback, and
   unmount/dispose restore scopes and release owned consumers.
5. Shared JSX plus createElement, public declarations, source/built browser
   loading, and the new package's focused packed Bundler/NodeNext import probe.

The implementation plan chooses concrete existing test harnesses and exact
commands after the prerequisite reinspection. Observe focused RED before
production changes, then GREEN for the runnable slice. Do not write exhaustive
matrices, broad performance benchmarks, or run the aggregate trust gate before
hands-on feedback. Use semantic geometry first; only add narrow visual evidence
where it proves a gap or paint behavior that semantic assertions cannot.

Once working, publish the **actual running Studio URL** (never an assumed port),
explain resizing and data/event controls, list fresh focused check results, and
label the milestone **slice ready for feedback**. Stop for experiential feedback.

### Deferred scope and self-review

Retain the approved wider scale inventory, percentage and bandwidth ranges,
bar grouping/bandwidth/style contracts, financial series, curve vocabulary,
and segment-style direction below. Their presence does not authorize expansion
of this slice. Also defer time/UTC scales, domain helpers, nice/clamped scales,
PointSeries, bands/bars/financial marks, areas, pies, force/geography, legends,
annotations, nearest lookup, rich axes, cross-Layer provider lookup, curve and
ownership matrices, geometry cache optimization, documentation polish,
performance characterization, and aggregate verification until feedback or a
separate approved scope requires them.

Self-review: the first-slice export list matches its type declarations; every
signal input uses core's vocabulary; captured allocation refresh relies on the
named unshipped core dependency; scope failure and Layer limits are explicit;
axis direction is distinct from range reversal; labels reserve no hidden space;
invalid scale definitions throw while missing series coordinates make gaps;
series batching and hit geometry agree; future APIs below are not slice exports.
No production code accompanies this specification. The separate
[implementation plan](../plans/2026-09-28-first-class-data-visualization-slice.md)
is approved for inline execution, subject to its prerequisite check.

---

## Approved foundation and longer-term direction

The remainder preserves the decisions and unresolved future surface recorded on
2026-09-24. “Initial” in these historical sections describes that larger package
direction, not the narrower first-slice export list above. Their sample snippets
may use capabilities deferred from this slice.

## Summary

CRC will eventually provide one official `@crc/viz` package for fast,
interactive Canvas data visualization without a D3 or other visualization
runtime dependency. The package will be CRC-native: ordinary synchronous
components, the shared JSX runtime, local allocation and layout, normal CRC
events, and the realm signal graph remain the authoring and execution model.

The design is intentionally component-compositional rather than centered on a
monolithic `Chart` component or a high-level declarative chart grammar. Nested
`Scale` components establish named coordinate mappings. Axes, series, ordinary
CRC primitives, and user components consume those mappings explicitly. This
allows an author to compose an unusual visualization without escaping the
library while still making familiar charts short recipes.

The first package will not export `LineChart`, `LinePlot`, `Sparkline`, or
similar chart-level components. Public examples will demonstrate those
compositions alongside bars, pies, force-directed diagrams, financial charts,
and other common forms. Repeated demand may justify convenience components
later, after the lower-level vocabulary is proven.

The approved design currently covers:

- package and composition boundaries;
- scale identity, scope, range binding, and signal behavior;
- responsive allocation and multiple independent visualizations;
- data/accessor and style resolution;
- low-level scale-aware placement through `ScaleAdjust`;
- interaction principles and nearest-domain lookup;
- initial `LineSeries`, `BarSeries`, and financial-series direction; and
- the role of examples versus chart-level components.

Exact axes, `PointSeries`, area and radial geometry, legends, annotations,
force simulation, pie/arc APIs, hierarchy, geospatial work, advanced
interaction, accessibility presentation, and large-data policies remain for
future design.

## Surface snapshot at pause

| Surface                     | Status in this record                                                         |
| --------------------------- | ----------------------------------------------------------------------------- |
| `Scale`                     | Foundation approved; exact prop unions and resolved-scale methods incomplete  |
| `useScale`                  | Approved as a readonly signal lookup by scale ID                              |
| `ScaleAdjust`               | Approved for translating arbitrary CRC subtrees through named scales          |
| `Axis`                      | Direction approved; complete public API deferred                              |
| `LineSeries`                | Initial geometry, gaps, curve vocabulary, and segment styling approved        |
| `PointSeries`               | Name and shared series/style conventions approved; exact geometry deferred    |
| `BarSeries`                 | Vertical, horizontal, value, range, grouping, and stack separation approved   |
| `HighLowSeries`             | Role approved; exact prop and style contract deferred                         |
| `OHLCSeries`                | Role and named style parts approved; exact prop contract deferred             |
| `CandlestickSeries`         | Role and named style parts approved; exact prop contract deferred             |
| `BoxPlotSeries`             | Role and named style parts approved; exact statistical contract deferred      |
| `boxPlotSummary`            | Pure-helper direction approved; exact signature deferred                      |
| `timeDomain`, `valueDomain` | Pure-helper naming direction approved; exact signatures deferred              |
| `nearestDomainValue`        | One-dimensional pure-helper responsibility approved; exact signature deferred |
| `stackSeries`               | Only a provisional name for a pure transform; not approved API                |

This table is a navigation aid, not an export manifest. Anything marked
incomplete or deferred requires another design decision before implementation.

## Intent

The package is for authors who need both ends of the visualization spectrum:

- a small sparkline or ordinary line chart should require only a few nested
  components;
- a dashboard should support several independently responsive charts without
  global coordination machinery;
- financial and statistical marks should compose with ordinary lines, points,
  bars, axes, labels, and arbitrary CRC drawing components;
- custom visualizations should be able to consume the same scales, events,
  styles, signals, layout allocation, and renderer rather than dropping into a
  separate framework; and
- high-frequency data and pointer updates should preserve CRC's explicit,
  scheduled, allocation-conscious runtime model.

Human readability and agent readability are both design requirements. Common
behavior should be visible at the call site, names should carry domain meaning,
and opaque configuration languages or hidden inference should be avoided.

## Design principles

### CRC-native rather than a wrapped D3

`@crc/viz` ships the algorithms it exposes. It does not require D3 for scales,
ticks, shapes, interpolation, spatial lookup, layouts, or interaction. D3 is a
capability reference and a source of ecosystem lessons, not a runtime layer or
an API that CRC must clone.

The package uses the same branded element protocol and automatic JSX runtime as
`@crc/core`. It does not publish another element constructor, Fragment, hook
runtime, event system, renderer loop, or retained scene graph.

### Fine-grained components first

The primary vocabulary is scales, axes, series, transforms, geometry helpers,
and ordinary CRC primitives. A chart is the tree an author composes. This keeps
unusual overlays, mixed mark types, annotations, custom labels, and application
controls from fighting a chart-level abstraction.

### Easy forms are examples before abstractions

Line charts, scatter plots, combined line-and-point charts, sparklines, grouped
and stacked bars, and common financial displays are required learning examples.
Their initial value is to prove that the primitives compose cleanly. They do
not automatically become exported chart components.

### Signals are the reactive substrate

Visualization inputs participate in the same signal graph as core and the
official sibling packages. Scales themselves are reactive derived values. The
package does not create an independent observable type, subscription system,
resize loop, or animation loop.

### Explicit data flow over descendant registration

Scale domains come from explicit values or computed signals. Descendant series
do not imperatively register domain contributions with an ancestor chart. This
keeps render order, ownership, equality, teardown, and multi-series coordination
deterministic.

### Batched series rather than a component per datum

One series component consumes a dataset and emits one or a small number of
Canvas paths or mark batches. Per-datum components are not the default model.
Opt-in per-datum or per-segment styling may require additional paint batches,
but the static-style path remains cheap.

## Package boundary

The initial surface is one `@crc/viz` package. Maintaining several packages for
scales, shapes, layouts, and interaction would create avoidable release and
authoring complexity before their boundaries have been proven.

Heavy capability may later receive explicit subpath entries when it has a
meaningful loading or platform boundary. Force simulation and geospatial data
are possible candidates. They are not separate packages by default, and no
subpath is approved by this record.

`@crc/viz` depends on the public and official-package seams of `@crc/core`. It
must not reach through `@crc/core/lib/*` or source paths. It imports the shared
`SignalValue` vocabulary rather than defining `MaybeSignal` or a package-local
reactive convention.

## Signal-valued inputs

Visualization components follow the signal-centric authoring design in
`2026-09-23-signals-centric-authoring-design.md`.

```tsx
const data = useSignal(initialData);
const domain = useComputed(() => valueDomain(data.get(), "value"));

<Scale id="y" type="linear" domain={domain} range="height">
  <LineSeries data={data} x="time" y="value" xScale="x" yScale="y" />
</Scale>;
```

Passing `data={data}` makes the receiving series own the signal dependency.
Passing `data={data.get()}` makes the enclosing component own it. Both forms are
supported; the difference is dependency ownership rather than value semantics.

`data={() => data.get()}` is not a third reactive-input convention. A function
is data only where the declared prop type says it is data, and is an accessor or
callback only where that prop declares a function. A series `data` prop expects
an array or a signal-valued array, so an unrequested thunk is invalid. This
avoids making every function-valued prop ambiguous between lazy data, an
accessor, an event handler, and an ordinary function value.

CRC-owned schemas resolve signals only at declared positions. A series may
accept `SignalValue<readonly Datum[]>`, but it does not search dataset rows for
signals. A scale may accept a signal-valued complete domain, range, or approved
option, but it does not recursively unwrap arbitrary application objects.

A style resolver may call signals explicitly:

```tsx
<PointSeries
  data={points}
  x="x"
  y="y"
  xScale="x"
  yScale="y"
  style={(datum) => ({
    fill: datum.selected ? selectedColor.get() : normalColor.get(),
  })}
/>
```

Those reads belong to the receiving series evaluation. Signals hidden inside
ordinary datum objects or resolver-returned application payloads are not
discovered automatically.

## Scale composition

### `Scale`

There is no required `Chart` ancestor. A `Scale` component declares one named
mapping and makes its resolved value available to descendants.

```tsx
<Scale id="x" type="time" domain={timeDomain(data, "timestamp")} range="width">
  <Scale
    id="y"
    type="linear"
    domain={valueDomain(data, "value")}
    range="height"
    reverse
  >
    <LineSeries data={data} x="timestamp" y="value" xScale="x" yScale="y" />
  </Scale>
</Scale>
```

The approved identity and scope rules are:

- `id` is required and accepts a `string` or `symbol`;
- CRC does not export `createScaleId`; ordinary string and symbol construction
  is sufficient;
- scale lookup is lexical through the visualization component tree;
- a nearer scale may shadow an outer scale with the same ID;
- IDs do not imply an axis or chart role; names such as `x`, `price`, or
  `comparisonColor` are application choices; and
- a `Scale` is structural. It establishes context and does not paint, allocate
  hit geometry, or create a renderer surface.

The initial scale-family inventory is:

| Family                    | Initial types                                                            |
| ------------------------- | ------------------------------------------------------------------------ |
| Continuous                | linear, power, square-root, logarithmic, symmetric logarithmic, identity |
| Temporal                  | local time, UTC                                                          |
| Categorical               | band, point, ordinal                                                     |
| Discretizing              | quantize, quantile, threshold                                            |
| Color/value interpolation | sequential, diverging                                                    |

The exact discriminated TypeScript options, tick methods, formatter surface,
clamping, unknown values, nice domains, and interpolation descriptors remain to
be completed. The family inventory is approved; every D3 option is not.

### Scale values are in the signal graph

`useScale(id)` returns a readonly stable signal whose value is the current
resolved scale:

```ts
const xScale = useScale("x");
const x = xScale.get().map(datum.timestamp);
```

Conceptually, `Scale` derives a resolved scale from its domain, range, options,
and local allocation. Changes propagate through the existing synchronous signal
graph and schedule ordinary CRC work. A scale is not merely recomputed as an
incidental render-local object, and it does not emit custom resize or change
events.

The exact `ResolvedScale` method names remain open. It must ultimately expose
the capabilities appropriate to its family, including mapping and, where
defined, inversion, ticks, formatting, or bandwidth. Unsupported operations
must be represented in types or fail with an actionable diagnostic rather than
silently returning nonsense.

### Ranges and local allocation

Scale ranges may be declared in logical pixels or relative to the current local
allocation. Approved conveniences include:

```tsx
<Scale id="x" type="linear" domain={[0, 100]} range="width" />
<Scale id="y" type="linear" domain={[0, 100]} range="height" reverse />
<Scale id="detail" type="linear" domain={[0, 1]} range={[24, "80%"]} />
```

`range="width"` and `range="height"` bind to the receiving scale's local
layout box rather than the root Canvas. Percentage endpoints resolve against
the selected local extent. Numeric endpoints are logical CRC pixels. `reverse`
changes range direction without forcing authors to reconstruct an equivalent
tuple.

The final typing for percentage endpoints and how a non-axis-specific range
tuple selects its percentage basis remain open. The important approved
contract is local, allocation-relative resolution rather than a global chart
rectangle.

### Nested band ranges

Grouped categorical marks use an explicit inner band scale whose range is the
outer band scale's bandwidth:

```tsx
<Scale id="month" type="band" domain={months} range="width" paddingInner={0.12}>
  <Scale
    id="region"
    type="band"
    domain={regions}
    range={{ bandwidthOf: "month" }}
    paddingInner={0.08}
  >
    <BarSeries
      data={sales}
      x="month"
      y="revenue"
      group="region"
      xScale="month"
      yScale="revenue"
      groupScale="region"
      style={(datum) => ({ fill: regionColors[datum.region] })}
    />
  </Scale>
</Scale>
```

`range={{ bandwidthOf: scaleId }}` resolves to `[0, bandwidth]`. The referenced
scale must be a visible ancestor band scale, must resolve to a positive
bandwidth, and must not create a scale dependency cycle. Resizing or changing
the outer scale updates the inner scale through the signal graph in the same
scheduled frame.

For grouped vertical bars, the series conceptually resolves:

```ts
x = categoryScale.map(category) + groupScale.map(group);
width = groupScale.bandwidth;
```

Horizontal grouping applies the same composition along the y-axis. Grouping is
therefore scale composition rather than a separate `GroupedBarSeries`.

## Scale-aware custom composition

### `useScale`

Custom visualization components read named scales directly through
`useScale(id)`. This is the primary low-level extension point for geometry that
spans several domain coordinates or needs scale-family-specific capabilities.

### `ScaleAdjust`

`ScaleAdjust` maps one or both domain coordinates through named scales and
translates an arbitrary CRC subtree:

```tsx
<ScaleAdjust x={datum.time} xScale="x" y={datum.value} yScale="y">
  <Circle style={{ radius: 4, fill: "tomato" }} />
</ScaleAdjust>
```

It is structural rather than a drawing primitive:

- it adds no hit geometry of its own;
- descendants keep their ordinary CRC paint and event behavior;
- it does not claim or alter layout allocation;
- it composes with `Group`, `Clip`, filters, Layers, and ordinary primitives;
  and
- a missing coordinate leaves that axis untranslated.

`ScaleAdjust` is the approved name. `ScalePosition` and a separate family of
scale-aware wrappers for every core primitive were rejected. Series components
provide efficient data batching; arbitrary one-off marks use `ScaleAdjust` or a
custom component with `useScale`.

## Accessors and explicit domain computation

Datum selection accepts either a property key or a function:

```tsx
<PointSeries data={points} x="timestamp" y={(datum) => datum.metrics.value} />
```

A property key is normalized once into an internal accessor. A function is
called directly. CRC does not introduce accessor-builder objects for ordinary
cases.

Domain helpers are pure functions, not hooks and not inline component-like
values:

```ts
const xDomain = timeDomain(data, "timestamp");
const yDomain = valueDomain(data, "value");
```

Reactive domains use ordinary computed signals:

```ts
const yDomain = useComputed(() => valueDomain(data.get(), "value"));
```

Names beginning with `use` are reserved for actual CRC hooks. A helper must not
be named `useTimeDomain` or `useValueDomain` merely because it is useful inside
a component.

Scales do not collect domains from descendant series. Multiple series share an
explicit domain value or computed signal assembled by the author or a pure
helper. The exact helper catalog, inclusive-baseline options, empty-data
behavior, and date/numeric validation remain to be designed.

## Responsive sizing and multiple visualizations

Responsive behavior follows core rather than introducing one observer per
chart or scale:

- the CRC root owns the native Canvas surface observation already required by
  responsive root mode;
- layout gives each subtree a local allocation;
- `range="width"`, `range="height"`, and percentages resolve against that local
  allocation;
- allocation changes invalidate the affected derived scale signals and normal
  rendering work; and
- visualization components do not expose imperative `resize()` methods or
  bespoke resize events.

Four charts in a Grid, Flex, Flow, or other allocated layout each derive ranges
from their own box. A chart in normal document flow is responsive when its CRC
root and layout allocation are responsive. A plain `Group` transforms drawing
coordinates but does not itself invent a layout box; allocation-relative scales
must ultimately be placed under a component that provides an allocation.

This preserves one resize authority, one realm scheduler, and the existing
root/logical/backing-space distinctions.

## Axis direction

An `Axis` consumes a named scale and places ticks relative to that scale's local
range frame, not relative to an implicit global `Chart` rectangle. Position
names such as `"bottom"` mean the bottom edge of that resolved frame.

The design does not yet lock the complete `Axis` API. Future work must specify:

- which allocated containers establish an axis frame;
- whether explicit cross-scale/frame IDs are ever necessary;
- tick generation, filtering, formatting, density, collision, and rotation;
- grid lines and minor ticks;
- label measurement and reserved layout space;
- axis titles and annotations;
- styling of the baseline, ticks, labels, grid, and title; and
- behavior under transformed `Group` trees without a new allocation.

`Canvas` is not the only possible owner; any appropriate allocated CRC subtree
may establish the local frame. A transform-only `Group` is not automatically an
independent responsive frame.

## Style resolution

### Independent marks

Series made from independent marks may accept either one shared style object or
a datum resolver:

```tsx
<PointSeries
  data={points}
  x="x"
  y="y"
  xScale="x"
  yScale="y"
  style={{ fill: "steelblue", radius: 3 }}
/>;

<PointSeries
  data={points}
  x="x"
  y="y"
  xScale="x"
  yScale="y"
  style={(datum, index, data) => ({
    fill: datum.alert ? "crimson" : "steelblue",
    radius: datum.important ? 5 : 3,
  })}
/>;
```

The outer style input may itself be signal-valued under the signals-centric
contract. A function-valued style is an opaque accessor, not a signal and not a
style object to recursively inspect.

The returned style object is ordinary data. Signals nested in a returned object
are not discovered automatically. A resolver may make an explicit signal read
when it needs reactive external state.

Constant styles are the batching fast path. Datum resolvers are opt-in and may
create more paint batches when resolved styles differ.

### Aggregate paths

An aggregate path such as one line has one base `style`. Per-datum style is not
well-defined for a continuous path. `LineSeries` therefore uses an explicitly
named `segmentStyle` when segment-specific appearance is required.

### Composite marks

Financial and statistical marks keep all appearance under `style`, with named
parts:

```tsx
<CandlestickSeries
  data={prices}
  x="date"
  open="open"
  high="high"
  low="low"
  close="close"
  xScale="time"
  yScale="price"
  style={(datum) => ({
    bandwidth: "auto",
    body: {
      fill: datum.close >= datum.open ? "#16a34a" : "#dc2626",
    },
    wick: {
      stroke: "#334155",
      strokeWidth: 1,
    },
  })}
/>
```

Approved part vocabulary is:

| Series              | Named style parts                            |
| ------------------- | -------------------------------------------- |
| `CandlestickSeries` | `body`, `wick`                               |
| `OHLCSeries`        | `stem`, `openTick`, `closeTick`              |
| `BoxPlotSeries`     | `box`, `median`, `whisker`, `cap`, `outlier` |

Omitted parts use component defaults. Parts do not implicitly inherit from one
another. The precise style fields and defaults remain to be specified.

### `bandwidth` versus `strokeWidth`

Both names are required because they represent different dimensions:

- `bandwidth` is the cross-axis size of a bar, candle body, OHLC tick span, box,
  or similar data mark; and
- `strokeWidth` is the paint thickness of a line, border, wick, stem, or
  whisker.

`bandwidth` belongs in style because it controls appearance, even though its
automatic value may depend on scales and data. An automatic bandwidth may come
from a band scale or, for suitable continuous data, from projected neighbor
spacing. Exact continuous-scale inference and sparse-data failure behavior
remain to be completed.

## Shared series behavior

The initially accepted series names are:

- `LineSeries`
- `PointSeries`
- `BarSeries`
- `HighLowSeries`
- `OHLCSeries`
- `CandlestickSeries`
- `BoxPlotSeries`

`boxPlotSummary` is the approved direction for a pure statistical helper that
derives quartiles, median, whiskers, and outliers from raw samples. Its exact
method options and output shape remain open.

Series consume arrays or signal-valued arrays, scale IDs, and key-or-function
accessors. They preserve source order unless a particular algorithm explicitly
documents otherwise. They do not mutate or silently sort application data.

Missing or invalid coordinates skip independent marks. In a connected series,
they create a break rather than silently joining across the missing datum. An
optional `defined` accessor lets an author make that policy explicit.

No series implicitly clips to a chart rectangle. Authors use core `Clip` when
clipping is required. A future small `PlotClip` convenience remains possible
but is not approved here.

## `LineSeries`

`LineSeries` maps one ordered dataset to one line. Multiple lines compose as
multiple keyed components rather than a grouping grammar inside the component.

```tsx
<LineSeries
  data={measurements}
  x="timestamp"
  y="temperature"
  xScale="time"
  yScale="temperature"
  curve="monotone-x"
  style={{
    stroke: "#5b8def",
    strokeWidth: 2,
  }}
/>
```

The approved core props are:

| Prop               | Meaning                                              |
| ------------------ | ---------------------------------------------------- |
| `data`             | Ordered array or signal-valued ordered array         |
| `x`, `y`           | Property-key or function accessors                   |
| `xScale`, `yScale` | Visible scale IDs                                    |
| `defined`          | Optional datum predicate; false creates a path break |
| `curve`            | Interpolation descriptor; defaults to linear         |
| `style`            | Whole-line appearance                                |
| `segmentStyle`     | Optional per-segment style overrides                 |

The component preserves input order and never silently sorts. Filtering a datum
out before passing `data` connects its surviving neighbors; returning false from
`defined` creates a visible gap. Band-scale coordinates are centered within
their bands for lines and points, unlike bars, which occupy a band extent.

### Curves

Fixed curves use readable string names. Parameterized curves use descriptors:

```tsx
curve="linear"
curve="step"
curve="step-before"
curve="step-after"
curve="basis"
curve="natural"
curve="monotone-x"
curve="monotone-y"
curve="bump-x"
curve="bump-y"

curve={{ type: "cardinal", tension: 0.4 }}
curve={{ type: "catmull-rom", alpha: 0.5 }}
curve={{ type: "bundle", beta: 0.85 }}
curve={{ type: "basis", mode: "open" }}
curve={{ type: "cardinal", mode: "closed", tension: 0.2 }}
```

CRC implements the approved algorithms directly. Imported D3-style curve
factory functions were rejected for ordinary use because strings and typed
descriptors are easier to read, serialize, validate, and distinguish from data
accessors.

Monotone curves require monotonic input on the named axis. They do not sort the
data and should provide an actionable development diagnostic for invalid order.
The exact production diagnostic policy and custom-curve extension point remain
open.

### Segment styling

`segmentStyle` receives adjacent source data and indices:

```ts
interface LineSegment<Datum> {
  readonly from: Datum;
  readonly to: Datum;
  readonly fromIndex: number;
  readonly toIndex: number;
}
```

```tsx
<LineSeries
  data={measurements}
  x="time"
  y="value"
  xScale="time"
  yScale="value"
  style={{ stroke: "#64748b", strokeWidth: 2 }}
  segmentStyle={({ to }) =>
    to.alert ? { stroke: "#dc2626", strokeWidth: 3 } : undefined
  }
/>
```

Returned properties override the base style for that segment. This is an
explicit slower path that may require several Canvas strokes. Curve geometry is
still derived from the complete contiguous run, so style boundaries do not
change tangents or smoothing.

Without `segmentStyle`, one contiguous run with one style remains one batched
path. Geometry may be cached until data, accessors, scales, definition policy,
or curve configuration changes.

## `BarSeries`

One `BarSeries` covers vertical, horizontal, ordinary, and ranged bars. There
are no separate `HorizontalBarSeries`, `RangeBarSeries`, `GroupedBarSeries`, or
`StackedBarSeries` components.

```tsx
<BarSeries
  data={sales}
  x="month"
  y="revenue"
  xScale="months"
  yScale="revenue"
  style={{ bandwidth: "auto", fill: "#5b8def" }}
/>
```

`orientation` defaults to `"vertical"`. The geometry is a discriminated union:

| Mode             | Required geometry                    |
| ---------------- | ------------------------------------ |
| Vertical value   | `x`, `y`; optional shared `baseline` |
| Vertical range   | `x`, `yStart`, `yEnd`                |
| Horizontal value | `y`, `x`; optional shared `baseline` |
| Horizontal range | `y`, `xStart`, `xEnd`                |

Ordinary bars extend from one shared domain baseline, which defaults to numeric
zero where zero is valid:

```tsx
<BarSeries
  data={sales}
  orientation="horizontal"
  y="month"
  x="revenue"
  baseline={0}
  xScale="revenue"
  yScale="months"
/>
```

Per-datum baselines use explicit range endpoints:

```tsx
<BarSeries
  data={forecasts}
  x="month"
  yStart="minimum"
  yEnd="maximum"
  xScale="months"
  yScale="revenue"
/>
```

The horizontal equivalent uses `xStart` and `xEnd`. A logarithmic or other
scale that cannot represent zero requires an explicit valid baseline or range
endpoints. Negative and reversed endpoints work by normalizing the two mapped
coordinates into rendered rectangle geometry.

Source order determines paint and event order. Missing category or endpoint
values skip a datum. `bandwidth` stays in style; domain endpoints stay in
geometry props.

### Grouping and stacking

When `groupScale` is supplied, `group` is required and accepts a property key
or accessor. Automatic bandwidth comes from the group scale. An explicit style
bandwidth may make a mark narrower or wider and is centered within its group
band. Ordering, padding, alignment, and reversal belong to the inner scale.

Stacking is a pure data transformation that produces start/end values rather
than a mode inside `BarSeries`. The provisional helper name is `stackSeries`;
its exact input and output types, ordering, normalization, missing-value, and
positive/negative divergence policies are not yet approved.

This separation permits grouped stacks without adding rendering components:
grouping composes coordinates, and stacking derives range endpoints.

## Financial and statistical series

The approved initial financial/statistical direction is:

- `HighLowSeries` for one low-to-high interval;
- `OHLCSeries` for a high-low stem with open and close ticks;
- `CandlestickSeries` for high-low wicks plus open-close bodies;
- `BoxPlotSeries` for quartile boxes, median, whiskers, caps, and optional
  outliers; and
- `boxPlotSummary` as the pure raw-sample-to-summary helper.

OHLC is accepted as the normal industry term. These components compose with
ordinary axes, points, lines, bars, annotations, and CRC primitives. They are
not chart containers and do not own scales.

Exact geometry props, orientation variants, bandwidth inference, statistics,
defaults, hit geometry, and event payloads remain to be specified before this
surface is implementation-ready.

## Interaction

Visualization components use ordinary CRC event props and the existing event
propagation, pointer capture, focus, cursor, and coordinate model. The design
rejects a visualization-specific `InteractionArea` component as redundant with
events on normal components and explicit CRC geometry. It also rejects a
`useVizTarget` hook because it hides ordinary event participation behind a
second target model.

The package will expose a one-dimensional pure helper in this direction:

```ts
nearestDomainValue(data, rangeValue, scale);
```

It accepts data or already selected domain values, a range-space coordinate,
and a resolved scale, then returns the nearest domain value. The exact accessor
shape, empty-data result, and tie policy remain open, but the responsibility is
deliberately small: inversion or range-space comparison plus nearest selection,
not event registration or datum-level interaction state.

Series may enrich relevant pointer events with a lazy memoized
`event.nearestDatum()` operation. Nearest-point work must not happen merely
because an event exists; it runs only when a consumer requests the value and at
most once for that event/series pair.

Applications that need nearest data anywhere across a plot attach an ordinary
handler to explicit plot geometry, such as a background rectangle, and invoke
the helper. A thin line's own event handler naturally fires according to its
line hit geometry rather than claiming the entire plot.

The following interaction areas remain open:

- efficient two-dimensional nearest-point indexing;
- hover versus touch/focus behavior;
- brush, lasso, pan, and zoom composition;
- enlarged hit geometry for thin marks;
- linked selections across visualizations;
- keyboard exploration and non-visual alternatives; and
- large-data picking and sampling.

## Examples required before chart-level conveniences

The public example catalog should eventually include at least:

- a minimal line chart;
- a scatter plot;
- a line with point marks;
- a sparkline with no axes;
- vertical and horizontal bars;
- ranged, grouped, stacked, and grouped-stacked bars;
- high-low, OHLC, candlestick, and box-plot compositions;
- a pie or donut composition;
- a force-directed graph;
- several independently responsive charts in Grid;
- charts in Flow and other allocation contexts;
- a custom mark built with `ScaleAdjust`;
- a custom multi-coordinate component built with `useScale`;
- lazy nearest-point interaction;
- missing-data gaps;
- signal-driven streaming or frequently updated data; and
- a deliberately small dataset alongside a large-data stress example.

These examples are part of API validation. If a familiar form is unexpectedly
verbose or requires private helpers, the primitives should be reconsidered
before a chart-level component papers over the problem.

## Performance and ownership constraints

The eventual implementation must preserve these constraints:

- one realm scheduler and no package-local frame loop;
- no observer per scale, chart, or series;
- no hidden native resize listener per visualization;
- no component per datum on the ordinary series path;
- no recursive signal discovery inside rows or arbitrary style payloads;
- no scale-domain mutation by descendant registration;
- no retained application scene graph;
- allocation and cached geometry ownership tied to component lifetime;
- exact cleanup of scale registrations, computed dependencies, event records,
  and spatial indexes; and
- plain inputs use a cheap path without wrapper signals or persistent reactive
  allocations.

Performance evidence should distinguish:

- data/accessor/scale changes that require geometry regeneration;
- style-only changes that may reuse geometry;
- pointer movement where nearest data is never requested;
- pointer movement with nearest lookup;
- constant-style batches versus per-datum or per-segment styling;
- several small responsive charts versus one dense chart; and
- first render, stable rerender, signal update, and teardown.

## Diagnostics

The final design should provide receiver-specific errors for at least:

- an unknown or out-of-scope scale ID;
- an incompatible scale family for a required operation;
- a nested bandwidth range referencing a non-band scale;
- cyclic scale range dependencies;
- a missing local allocation for an allocation-relative range;
- an invalid domain, range, baseline, or curve option;
- non-monotonic input for a monotone curve;
- a grouped bar missing `group` or `groupScale`;
- mutually exclusive value and range bar props; and
- a signal resolving to another signal or otherwise violating the official
  signal-input contract.

Diagnostics should name the receiving component, relevant prop or scale ID,
and the corrective action. Silent fallback is inappropriate where it could
produce a truthful-looking but incorrect visualization.

## Capability landscape for future design

D3 and the broader visualization ecosystem establish a large capability
landscape. This list is a research and design checklist, not an approved CRC API
or a promise of one-for-one parity.

### Data and statistics

- extent, min/max, quantiles, deviation, variance, cumulative sums, ranking;
- grouping, rollups, binning/histograms, stacking, normalization, and missing
  values;
- sampling, aggregation, downsampling, and level-of-detail strategies;
- uncertainty intervals, distributions, density, regression, and trend lines;
  and
- streaming windows and incremental calculations.

### Scales, formatting, and color

- continuous, temporal, categorical, discretizing, sequential, and diverging
  scales;
- nice domains, clamping, unknown values, copying, inversion, and tick
  generation;
- locale-aware number, date, duration, and financial formatting;
- color spaces, interpolation, palettes, contrast, and color-deficiency-safe
  defaults; and
- explicit invalid, missing, selected, focused, and alert encodings.

### Shapes and layouts

- lines, areas, symbols, links, arcs, pies, radial lines/areas, ribbons, and
  stacks;
- histograms, density contours, hexbin-like summaries, and heatmaps;
- force, hierarchy, tree, cluster, pack, partition, treemap, chord, and Sankey
  layouts;
- Delaunay/Voronoi, quadtrees, spatial indexes, and collision helpers; and
- annotations, reference bands, thresholds, labels, legends, and small
  multiples.

### Interaction and presentation

- hover/tap/focus inspection, brushing, lasso, drag, zoom, pan, and linked
  selections;
- touch-sized targets, keyboard traversal, reduced motion, and non-visual data
  access;
- export, snapshots, print, and deterministic headless evidence;
- responsive label and tick density rather than simple geometric scaling;
- stable interaction under live updates; and
- explainable diagnostics for hidden, sampled, aggregated, or stale data.

### Geography

- projections, paths, graticules, spherical measurements, clipping, and
  simplification;
- GeoJSON and topology ingestion;
- thematic maps, point/route layers, labels, and zoom-aware detail; and
- basemap sourcing, attribution, offline behavior, and political-boundary
  sensitivity.

Geography is explicitly not an initial priority. Its data size, projection,
topology, attribution, and tile concerns justify a separate future design pass.

## Deferred decisions

The paused design must not be treated as complete until at least these topics
are resolved:

1. Final `Scale` prop unions and `ResolvedScale` types.
2. Percentage-range basis and local frame ownership.
3. Complete tick, formatter, and `Axis` APIs.
4. `PointSeries` geometry, symbols, radius/area semantics, and batching.
5. Area, radial, pie/arc, histogram, heatmap, and link series.
6. Exact financial-series and `boxPlotSummary` types.
7. Legend and annotation composition.
8. Custom curve and custom scale extension boundaries.
9. Nearest-datum event types and spatial indexing.
10. Brush, selection, zoom, and linked-view state.
11. Force and hierarchy ownership, scheduling, determinism, and teardown.
12. Accessibility and keyboard/non-visual exploration for Canvas charts.
13. Large-data thresholds, sampling, decimation, and renderer escalation.
14. Animation and transitions under the shared animation/signal contracts.
15. Export and deterministic testing surfaces.
16. Whether any heavy capability warrants a package subpath.

## Explicitly rejected or deferred surface

The current record does not approve:

- a monolithic `Chart` component;
- initial `LineChart`, `LinePlot`, or `Sparkline` exports;
- a D3 runtime dependency;
- a second signal, event, resize, or animation system;
- automatic descendant domain registration;
- `createScaleId`;
- function children as the initial scale-consumption model;
- a scale-aware wrapper for every core shape;
- `InteractionArea`;
- `useVizTarget`;
- implicit clipping;
- implicit data sorting;
- separate horizontal, range, grouped, or stacked bar components;
- deep signal discovery inside datasets or arbitrary nested style objects;
- a required custom curve callback API in the initial line contract; or
- geography as an initial delivery priority.

## Historical resume point (superseded by the first-slice proposal)

When visualization design resumes, begin with the smallest unresolved contract
that blocks a runnable vertical slice. The strongest candidate is the exact
`Scale`/`ResolvedScale`/`Axis` contract needed for one responsive line-chart
example, followed by `PointSeries` and ordinary pointer inspection. That is a
suggested continuation point, not an approved implementation plan.

Before implementation, this partial record must be completed or superseded by
an implementation-ready written specification, self-reviewed for ambiguity and
internal consistency, reviewed by the user, and followed by a separate
implementation plan.
