> **Historical status: The inspection proposal was implemented on October 8, 2026; its shipping decision was updated after the October 9 public-API pilot.**

# Plan 008 inspection checkpoint — proposal, 2026-10-08

Status: The revised inspection design shipped in the optional visualization
inspection entry. The owner approved shipping after the public-API pilot on
October 9; raw pilot results and limitations remain in the dated evidence. The
proposal examples below are historical context.

Accepted revisions: `RenderedSeries` and `rendered()` replace snapshot names.
An optional pure `filter` callback replaces candidate string policies; no filter
means all eligible observations. `anchorInsideClips` is an imported predicate.
Duplicate x is rejected by default; `resolveDuplicate` accepts separately
imported first/last source-observation functions. Existing APIs retain their
contracts. These revisions supersede conflicting examples below.
CandlestickSeries authoring and TradingTimeScale acceptance are preserved.

## Proposed application authoring

Use a separate `@pibbl/core/viz/inspection` entry. Existing rendering entries
must not import its algorithms or adapters. Existing `defineSeries`, `closestX`,
`closestPoint`, `interpolateX`, and `HoverData` retain their public contracts;
factor their algorithms privately rather than silently changing coordinates.

```tsx
const observations = defineSeries({
  data: [
    { time: 0, price: 10 },
    { time: 10, price: 30 },
  ],
  x: "time",
  y: "price",
});

function Points() {
  const inspection = usePointInspection(observations);
  return (
    <PointSeries
      {...observations}
      xScale="time"
      yScale="price"
      inspection={inspection}
      onClick={withInspection((event, context) => {
        const snapshot = context.snapshot(inspection);
        if (!snapshot) return;
        const hit = context.request(nearestRecordedX, snapshot, {
          domainX: snapshot.domainXAtRoot({ x: event.x, y: event.y }),
          candidates: "eligible",
        });
        console.log(hit?.datum.price ?? "No observation");
      })}
    />
  );
}
```

Scales are ordinary ancestor providers; the example body teaches inspection
without proposing a new chart container. Standalone calls use
`inspection.snapshot()` and `nearestRecordedX(snapshot, options)` without an
event, HoverData, or another render. Missing snapshots yield no result.

For empty-space inspection, put the same adapter on an ancestor Group with a
transparent plot Rectangle behind the marks. Root coordinates are converted by
the captured series transform, never the handler ancestor's transform.

Prefer `(event, context)` to `event.inspection`: it makes opt-in dependencies
visible, preserves core event types and avoids global augmentation. Keyboard
handlers supply an explicit domainX or root point; they never synthesize a mouse.

Painted identity is a separate request:

```tsx
const hit = context.request(paintedPointAt, snapshot, {
  rootPoint: { x: event.x, y: event.y },
});
```

With overlapping circles, the last painted circle wins even if another circle's
center is nearer. Range/value/grouped bars use `useBarInspection(barInputs)` and
`paintedBarAt`; results always preserve category, optional group, valueStart,
valueEnd and local bounds. Original records remain typed. PlotSeries render
callbacks and PieLayout children already expose records; handlers should close
over those records/slices, with no lookup added merely to recover identity.

## Public contract outline

- `useNumericInspection(series)` returns a mount-owned NumericInspectionRef.
- `usePointInspection(series)` returns a mount-owned PointInspectionRef;
  its PointSnapshot additionally supports painted circle/ring lookup.
- `useBarInspection(inputs)` returns a mount-owned BarInspectionRef with a fixed
  bounds/value result contract for ordinary, range and grouped bars.
- Refs expose `snapshot(): Snapshot | undefined`. Optional series `inspection`
  props receive structural capture sinks; they do not import search algorithms.
  One ref binds one mounted receiver; conflicting binding is an error.
- `nearestRecordedX(snapshot, {domainX, candidates, maxDomainDelta?})` returns
  original datum/sourceIndex, domainX/domainY, anchorLocal/anchorRoot, and the
  absolute domain-x delta. Default tie: first source index.
  An undefined domainX (e.g. singular inverse transform) yields undefined.
  Do not invent stable keys for point/bar APIs that currently lack keyBy;
  application IDs remain on the original datum. Existing Plot/pie keys persist.
- `nearestRecordedPoint(snapshot, {rootPoint, candidates, maxRootDistance?})`
  returns the same record metadata and root-logical Euclidean distance. This
  intentionally differs from the existing local-distance closestPoint API.
- `sampleRecordedX(snapshot, {domainX, interpolation, maxDomainGap?, duplicateX?})`
  returns exact or interpolated data, retaining both neighbors and source
  indices. Exact/interpolated is a result union, not an operation selector.
- `paintedPointAt(snapshot, {rootPoint})` and
  `paintedBarAt(snapshot, {rootPoint})` return separately typed geometry records
  or undefined. No generic operation selector or universal painted-datum API.
- `withInspection(handler)` returns an ordinary typed event handler.
  Its second argument offers `snapshot(ref)` and
  `request(query, snapshot, options)`. Generic inference retains query result
  types. No promises; contexts cannot be retained for deferred queries.
- `domainXAtRoot(rootPoint)` converts through the captured inverse transform
  and x mapping; a singular transform yields undefined.
- Area and interval results need dedicated `nearestAreaX`/`nearestBandX`
  operations preserving baseline/both bounds, rather than scalarizing a band.
  Their exact authoring examples must be reviewed before implementation.

## Snapshot, coordinates and costs

Capture evaluated accessor values, source references/indices, resolved scales,
world transform, clip stack and relevant paint geometry from the successful
committed generation. Reuse values already evaluated during rendering; do not
rerun arbitrary accessors against mutable closures during an event. No search
occurs while capturing. Opt-in metadata has O(n) space/capture work and can reuse
existing generation-owned geometry. Do not claim zero-cost capture.

Unsuccessful renders do not publish new snapshots. Layer cache reuse preserves
its matching snapshot; outer placement/clip changes must compose into the
current root geometry. A signal write inside dispatch cannot switch later
requests to unpainted data. Explicit refs identify receivers; no series registry.

Snapshots are borrowed and generation-scoped. Standalone use is synchronous,
before the next committed replacement; stale or disposed snapshots throw an
actionable error. A dispatch pins its selected snapshots through that logical
dispatch. Results may be retained: numeric values/bounds are owned immutable
result values, while datum and neighbor records are original references, not
deep copies. Applications replace arrays/records to update rendered data; direct
mutation does not change captured values or promise an immutable original datum.

The optional adapter memoizes per logical dispatch, receiver generation, query
function identity and normalized scalar arguments, including undefined matches.
Equal newly allocated point/options objects count as identical requests.
Interpolation callbacks compare by identity. Queries must be synchronous and
pure. No memo cache survives dispatch; contexts expire afterward. Dispatch-owned
opt-in bookkeeping may be needed, but it must not pull algorithms into ordinary
events. Snapshot payloads release on replacement/unmount/disposal.

Root points and distances use root logical Canvas units, not CSS/device pixels;
local anchors/bounds use the series' pre-world-transform logical units. Domain
units follow the scale (e.g. UTC milliseconds); future trading slots must have
separately named operations and preserve the accepted TradingTimeScale design.

Nearest candidates require an explicit fixed-result policy: `eligible` includes
finite defined records, even offscreen; `anchor-in-clip` restricts anchors to the
committed clip intersection. Neither claims to be event targeting. Interpolation
never bridges excluded/missing runs, extrapolates, or ignores max gaps; preserve
existing ordered/duplicate validation. Initial searches are O(n); there is no
automatic sort or spatial index.

Painted lookup checks source order in reverse, actual fill/stroke geometry,
transforms and every clip/layer bound. It means geometric paint coverage, not
pixel-color/alpha readback or scene-wide occlusion. Transparent paint follows
the existing geometric event convention; filters do not enlarge geometry.
Explicit inspection of decorative pointerEvents="none" paint remains possible
because this query is not the logical event target. Stroke-only circles do not
match their hollow center. Padding and omitted/zero-size marks yield undefined.

## Coverage audit and proposed integration

| Existing family                | Observation result                                              | Painted identity                                                                       |
| ------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| LineSeries                     | numeric x/y; categorical positions require a dedicated contract | No universal record on segments/curves                                                 |
| PointSeries                    | numeric x/y; category identity never coerced                    | captured circle/ring, reverse source order                                             |
| AreaSeries                     | x/y plus baseline; gaps preserved                               | No universal record in filled area                                                     |
| IntervalBandSeries             | x plus lower/upper, reject reversed bounds                      | No universal record in filled band                                                     |
| BarSeries value/range/grouped  | category/group plus both endpoints and bounds                   | captured painted rectangle, reverse source order                                       |
| PlotSeries                     | original datum/index supplied to render, keyBy available        | attach handler to authored mark; arbitrary child geometry is not searchable by default |
| PieLayout/PieSlice             | existing datum/index/key/value/fraction/angles/center/radii     | close over supplied slice; hole/zero sweep have no wedge hit                           |
| Candles/volume, future Batch 1 | original OHLCV plus time and geometry                           | same capture/adapter ownership, dedicated geometry results                             |

Categorical point/line nearest operations require separately reviewed examples;
do not widen existing numeric query contracts. A bounds-aware band query must not
pick a fabricated midpoint. Audit completion includes signals, transformed and
clipped layouts/Layers, touch, keyboard and disposal for each applicable family.

Inspection Workbench will use clearly labeled deterministic simulated prices,
recorded versus estimated readouts, overlapping points and categorical risk-range
bars. The same queries serve plot-background, touch and explicit keyboard input.
Minimal registered examples teach standalone nearest-x, lazy handler requests,
and topmost painted identity independently. No candles or volume implementation
is included in this three-feature batch.

## Evidence and acceptance boundary

2026-10-08: primary agent inspected current queries, event coordinates, point/bar
renderers, area/band contracts, package exports and executable query test source.
Independent read-only subagent audited all current series and pie callbacks.
No tests run, no runnable slices, no fresh verification claims. Existing unrelated
plan README and brand output changes were preserved. Next: user review of this
proposal; revise examples before implementing material API changes.
