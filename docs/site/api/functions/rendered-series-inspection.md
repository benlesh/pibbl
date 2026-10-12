---
id: api-function-rendered-series-inspection
title: Rendered series inspection
summary: Query typed observations or painted marks from the last successful render, only when requested.
kind: api
slug: rendered-series-inspection
apiCategory: function
symbols:
  [
    anchorInsideClips,
    firstSourceObservation,
    lastSourceObservation,
    nearestRecordedPoint,
    nearestRecordedX,
    paintedBarAt,
    paintedPointAt,
    sampleRecordedX,
    useBarInspection,
    useNumericInspection,
    usePointInspection,
    withInspection,
    BarInspectionRef,
    BarRenderedSeries,
    InspectionCandidate,
    InspectionContext,
    InspectionRef,
    NearestRecordedPointHit,
    NearestRecordedPointOptions,
    NearestRecordedXHit,
    NearestRecordedXOptions,
    NumericDomainInterpolation,
    NumericDuplicateResolver,
    NumericInspectionRef,
    NumericRenderedAnchors,
    NumericRenderedFilter,
    NumericRenderedObservation,
    NumericRenderedSeries,
    PaintedBarHit,
    PaintedPointHit,
    PointInspectionRef,
    PointRenderedSeries,
    RecordedNumericHit,
    RecordedXSample,
    RenderedSeries,
    RenderedSeriesPoint,
    SampleRecordedXOptions,
  ]
---

# Rendered series inspection

Import from `@pibbl/core/viz/inspection`. Rendering-only applications can omit
this entry. Pass an optional inspection ref to one mounted series:

```tsx
import { signal, type PibblLogicalMouseEvent } from "@pibbl/core";
import {
  PointSeries,
  defineSeries,
  linearInterpolation,
} from "@pibbl/core/viz";
import {
  anchorInsideClips,
  lastSourceObservation,
  nearestRecordedX,
  sampleRecordedX,
  usePointInspection,
  withInspection,
} from "@pibbl/core/viz/inspection";

function InspectedPoints() {
  const series = defineSeries({
    data: [{ time: 0, price: 10 }],
    x: "time",
    y: "price",
  });
  const inspection = usePointInspection(series);
  return (
    <PointSeries
      {...series}
      xScale="time"
      yScale="price"
      inspection={inspection}
    />
  );
}
```

`useNumericInspection(series)` captures numeric line/point observations.
`usePointInspection(series)` also exposes point circle/ring geometry.
`useBarInspection(inputs)` captures value, range and grouped categorical bars.
Descriptors supply datum inference; hooks do not read data, subscribe to signals,
build indexes or run queries. The renderer records values it already evaluated.
Numeric capture requires continuous numeric scales; categorical point/line
inspection is not currently supported. Category/group identity in bars remains
its original string or number.

## Standalone queries

```ts
function QueryNearest() {
  const series = defineSeries({
    data: [{ time: 0, price: 10 }],
    x: "time",
    y: "price",
  });
  const inspection = usePointInspection(series);
  const rendered = inspection.rendered();
  if (rendered) {
    const hit = nearestRecordedX(rendered, { domainX: 8 });
    console.log(hit?.datum, hit?.sourceIndex, hit?.domainY);
  }
  return <PointSeries {...series} xScale="time" yScale="price" inspection={inspection} />;
}
```

`nearestRecordedX` selects by absolute horizontal domain distance, returning
`domainDelta`. `nearestRecordedPoint` accepts `rootPoint` and returns Euclidean
`rootDistance`. Equal distances choose the first source observation. Limits are
inclusive (`maxDomainDelta`, `maxRootDistance`); a missing requested domain x,
empty data or no qualifying row returns undefined. Invalid finite-coordinate or
negative-limit inputs throw actionable errors. These selections are not event
targets and do not require marks to cover the query point.

Results preserve the original typed `datum`, zero-based `sourceIndex`, captured
`domainX`/`domainY`, `anchorLocal` and `anchorRoot`. Domain units follow the scales,
such as UTC milliseconds. Local anchors are series-local logical Canvas units;
root anchors/distances use root-logical Canvas units, not CSS/device pixels.
`rendered.domainXAtRoot(rootPoint)` uses the captured inverse transform and scale.
A singular transform yields undefined for inversion and painted lookup.

No filter means all finite observations accepted by the renderer's `defined`
predicate participate, including offscreen anchors. An optional pure
`filter(candidate)` additionally restricts that request:

```ts
function QueryVisibleNearest() {
  const series = defineSeries({
    data: [{ time: 0, price: 10 }],
    x: "time",
    y: "price",
  });
  const inspection = usePointInspection(series);
  const rendered = inspection.rendered();
  if (rendered)
    nearestRecordedX(rendered, {
      domainX: 8,
      filter: anchorInsideClips,
    });
  return <PointSeries {...series} xScale="time" yScale="price" inspection={inspection} />;
}
```

`anchorInsideClips` tests the observation anchor against every committed clip and
Layer bound. It does not test scene-wide occlusion. Custom filters receive the
original datum/index, captured values/anchors and an `anchorInsideClips()` method;
false removes that row from consideration. Filters cannot restore undefined rows
and do not change what is rendered.

## Explicit interpolation

```ts
function QueryInterpolatedSample() {
  const series = defineSeries({
    data: [{ time: 0, price: 10 }],
    x: "time",
    y: "price",
  });
  const inspection = usePointInspection(series);
  const rendered = inspection.rendered();
  if (rendered)
    sampleRecordedX(rendered, {
      domainX: 8,
      interpolation: linearInterpolation(),
      resolveDuplicate: lastSourceObservation,
    });
  return <PointSeries {...series} xScale="time" yScale="price" inspection={inspection} />;
}
```

`sampleRecordedX` returns `kind: "exact"` with an original record, or
`kind: "interpolated"` with both original observations (including source indices),
fraction, domain values and mapped local/root anchors. An estimate has no invented
datum. Input x must be nondecreasing within each valid run. Missing/excluded rows
and filter rejections split runs; interpolation never bridges them or extrapolates.
`maxDomainGap` rejects larger intervals. Duplicate x rejects by default.
An optional `resolveDuplicate(first, next)` must return one of those supplied
observations; `firstSourceObservation` and `lastSourceObservation` are ordinary
imported resolver functions. Interpolation and resolver callbacks must be pure,
synchronous and return valid values.

## Lazy ordinary handlers

```tsx
function ClickSelection() {
  const series = defineSeries({
    data: [{ time: 0, price: 10 }],
    x: "time",
    y: "price",
  });
  const inspection = usePointInspection(series);
  const selection = signal<{ time: number; price: number } | null>(null);
  const onClick = withInspection<PibblLogicalMouseEvent>((event, context) => {
    const rendered = context.rendered(inspection);
    if (!rendered) return;
    const rootPoint = { x: event.x, y: event.y };
    const hit = context.request(nearestRecordedX, rendered, {
      domainX: rendered.domainXAtRoot(rootPoint),
    });
    selection.set(hit?.datum ?? null);
  });
  return (
    <PointSeries
      {...series}
      xScale="time"
      yScale="price"
      inspection={inspection}
      onClick={onClick}
    />
  );
}
```

The event is unchanged. The second argument expires when the synchronous handler
returns; promise-returning handlers/queries are unsupported. Contexts pin the
selected generation and memoize per logical dispatch, rendered identity, query
function identity and equal argument values, including undefined results.
Plain options and logical points compare by value; filter/interpolation/resolver
functions compare by identity. Reuse callback functions for repeatable requests.
Arguments do not accept arbitrary cyclic/class/array payloads. No query executes
without a request, and caches release at dispatch completion.

For empty-space selection attach the adapter to a plot ancestor and put a
transparent Rectangle behind the marks. Root conversion uses the inspected
series' transform, not the ancestor handler's. Click/tap use ordinary events;
keyboard handlers supply an explicit domain value or root point. They never
invent a pointer. No additional hover subscription or render is necessary.

## Painted discrete marks

`paintedPointAt(rendered, { rootPoint })` selects the last-painted circle/ring
covering the point. It returns the original observation plus local radius and
stroke width; hollow centers and zero-radius marks have no match.
`paintedBarAt(rendered, { rootPoint })` selects the last-painted rectangle and
returns original datum/index, category/group, `valueStart`/`valueEnd` (including
baseline for ordinary bars), and `boundsLocal`.

These linear reverse-order lookups respect actual geometric fill/stroke,
transforms, arbitrary clips and Layer bounds. They do not read pixels, resolve
scene-wide occlusion or change the logical event target. Transparent paint follows
Pibbl's existing geometric targeting convention; filters do not expand lookup
geometry. Explicit inspection can query decorative `pointerEvents="none"` paint.

Line segments, filled areas and interval bands have no universal original datum
at every painted position. Their painted-datum operation is deliberately
unsupported. Custom PlotSeries marks already receive datum/index in `render`;
attach a handler to authored geometry. PieLayout/PieSlice already supply original
datum/index/key, values, angles and radii; close over that slice rather than search
again. Area/band observation queries preserving baseline/both bounds are pending
their dedicated authoring checkpoint.

## Ownership and cost

`rendered()` returns undefined before first successful paint/after unmount or
disposal. A rendered series is borrowed from one committed visual generation;
stale/disposed queries throw. Signal writes schedule a later render and do not
replace captured values during dispatch. Results may be retained: geometry and
calculated values are read-only, while original datum/neighbor references remain
caller-owned and are not deeply frozen. Replace records through signals rather
than mutating them in place to keep original data and painted values aligned.

Optional capture retains O(n) row metadata. Queries use O(n) scans; interpolation
also uses O(n) temporary run storage. There is no sorting, speculative spatial
index, global series registry, per-row event object or additional scheduler.
Existing `closestX`, `closestPoint`, `interpolateX` and HoverData retain their
current-data/local-coordinate contracts; they are not silently converted to
committed-render inspection.

## Current coverage

| Family             | Supported observation contract                                               | Painted identity                                  |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| LineSeries         | Finite numeric x/y, original record/index, contiguous runs                   | Unsupported on continuous segments/curves         |
| PointSeries        | Finite numeric x/y; defined gaps and zero-radius observations preserved      | Circle/ring fill and stroke, reverse source order |
| BarSeries          | Original category/group, baseline or range endpoints, local rectangle bounds | Value/range/grouped rectangles, both orientations |
| AreaSeries         | Baseline-preserving inspection pending a dedicated design                    | Unsupported on continuous fill                    |
| IntervalBandSeries | Both-bounds inspection pending a dedicated design                            | Unsupported on continuous fill                    |
| PlotSeries         | Existing render callback supplies original record/index/key                  | Close over the record in an authored mark handler |
| PieLayout/PieSlice | Existing slice supplies record/index/key/value/fraction/angles/radii         | Close over the slice in an authored wedge handler |
| Candles/volume     | Pending financial batch; will share this ownership foundation                | Dedicated geometry contracts pending              |

Every supported captured family uses the same successful-root generation,
transformed/clipped coordinates, dispatch memoization, signal-update and disposal
rules. A clean cached Layer reuses evaluated data while a changed ancestor
transform or clip produces a new borrowed root generation. One ref supports one
live series receiver; a keyed replacement may adopt the same surviving hook.
Failed rendering follows core teardown semantics: the inspection ref releases
its metadata and retained borrowed generations reject queries.
