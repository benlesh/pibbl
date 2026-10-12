---
id: api-function-financial-series
title: Financial series
summary: Render and inspect original financial observations and compare cumulative returns from an exact common base.
kind: api
slug: financial-series
apiCategory: function
symbols:
  [
    ComparisonBaseOptions,
    PercentageReturnPoint,
    IndexedValuePoint,
    percentageReturns,
    indexTo100,
    CandlestickSeries,
    CandlestickSeriesProps,
    CandlestickSeriesStyle,
    CandleBodyStyle,
    CandleWickStyle,
    useCandleInspection,
    nearestRecordedCandleX,
    paintedCandleAt,
    CandleObservation,
    CandleInspectionCandidate,
    NearestCandleHit,
    PaintedCandleHit,
    CandleInspectionRef,
    CandleRenderedSeries,
    TradingTimeScale,
    useTradingTimeScale,
    TradingTimeScaleProps,
    ResolvedTradingTimeScale,
    VolumeSeries,
    VolumeSeriesProps,
    VolumeSeriesStyle,
    useVolumeInspection,
    nearestRecordedVolumeX,
    paintedVolumeAt,
    VolumeObservation,
    VolumeInspectionCandidate,
    NearestVolumeHit,
    PaintedVolumeHit,
    VolumeInspectionRef,
    VolumeRenderedSeries,
    VisibleOhlcPriceExtentOptions,
    PadLinearDomainOptions,
    visibleOhlcPriceExtent,
    padLinearDomain,
  ]
---

# Financial series

Import rendering from `@pibbl/core/viz` and optional queries from
`@pibbl/core/viz/inspection`. VolumeSeries places numeric UTC-millisecond records
on a time scale with an independent numeric volume scale. It does not sort,
aggregate, mutate records, infer sessions, or execute queries during rendering.

```tsx
import { LinearScale, UTCScale, VolumeSeries } from "@pibbl/core/viz";

function Volumes() {
  return (
    <UTCScale id="time" domain={[1000, 2000]} range={[20, 180]}>
      <LinearScale id="volume" domain={[0, 100]} range={[100, 20]}>
        <VolumeSeries
          data={[
            { time: 1000, volume: 20 },
            { time: 2000, volume: 60 },
          ]}
          time="time"
          volume="volume"
          xScale="time"
          yScale="volume"
          style={{ width: 12, fill: "#087f8c" }}
        />
      </LinearScale>
    </UTCScale>
  );
}
```

The baseline is zero. Zero-volume rows remain inspectable but paint no rectangle.
Missing/nonfinite accessor values skip a row; finite negative volume rejects.
`defined` runs before accessors. Every result preserves the original datum and
source index, including indices before skipped rows. Style callbacks are plain,
hook-free functions. `style.width` is positive local logical units; default width
is 70% of the smallest positive adjacent mapped spacing, capped at 12 (singleton
fallback 8). Colors are application policy, not an implied financial meaning.
Adjacent equal styles share paint paths; no child component is created per row.

## Optional inspection

`useVolumeInspection(inputs)` infers datum types from data/time/volume without
reading or subscribing to them. Pass its stable ref to one VolumeSeries's
`inspection`. `rendered()` returns the last committed generation or undefined
before paint/after disposal. Borrowed values expire on the next root generation
or disposal, using the same ownership, transforms and clips as other inspection.

`nearestRecordedVolumeX(rendered, { time, filter? })` returns a `NearestVolumeHit`
or undefined. `time` and `timeDelta` use UTC milliseconds. Ties choose first
source index. Default eligibility includes observations outside clips; opt in
with `filter: candidate => candidate.anchorInsideClips()` to test the volume
endpoint. Filters receive captured values and the caller-owned original record.

`paintedVolumeAt(rendered, { rootPoint })` returns a `PaintedVolumeHit` or undefined.
It inverse-transforms root-logical coordinates, applies committed clips and
examines fill/stroke coverage in reverse source order. Zero-height columns,
transparent opacity, gaps and singular transforms return no result. Geometric
coverage does not perform scene-wide occlusion or pixel-alpha analysis.

Both hits contain `datum`, `sourceIndex`, `time`, `volume`, `baseline: 0`,
`anchorLocal`, `anchorRoot`, and `boundsLocal`. Bounds and local anchors are in
series-local logical units; root anchors use Pibbl event coordinates. Calculated
values are copied at paint; original datum objects remain application-owned.
`timeAtRoot(rootPoint)` supplies the committed inverse mapping.

Use the existing `withInspection` adapter when event-local pinning and memoized
requests are useful. Ordinary events are unchanged and no query executes until
requested. Copy values into application state if they must outlive the borrowed
generation. See [rendered series inspection](./rendered-series-inspection.md).

## Trading time

`TradingTimeScale` accepts `timestamps`, optional controlled `logicalRange`, and
`range`. Timestamps are safe UTC-millisecond integers, strictly increasing and
unique. They occupy consecutive logical slots even across absent observations.
This compresses observations, without exchange-calendar inference. UTCScale
continues to map elapsed time. Default viewport is half a slot before/after the
supplied observations; empty/singleton viewports are finite.

`useTradingTimeScale(id)` supplies explicit operations: `map(time)` accepts only
a supplied timestamp and rejects unknown values; `mapSlot(slot)` maps fractional
slots/whitespace; `slotAtTime(time)` and `timeAtSlot(slot)` are exact lookups with
undefined misses. `slotAtPosition(position)` returns a fractional logical slot;
`nearestTimeAtPosition(position)` selects supplied UTC timestamps, ties earlier,
clamped to supplied endpoints, undefined for empty data. There is no ambiguous
UTC interpolation or overloaded inverse method.

Axis ticks choose visible supplied timestamps; formatting is ISO UTC by default.
Line, point, area, interval-band, custom Plot and ScaleAdjust use the same exact
map. The public continuous-scale hook and numeric navigation contracts are
unchanged; trading has a dedicated hook. Pan/zoom by updating logicalRange in slot
units, rather than changing timestamps. When prepending history, preserve the
application's chosen timestamp anchor by adding the inserted observation count
to both controlled logical endpoints. No hidden viewport state is retained.

Legacy `HoverData` uses numeric continuous scales and does not accept a trading-time
mapping. Use the optional captured inspection APIs and explicit `timeAtRoot` lookup
for supplied trading observations.

## Visible price domains

`visibleOhlcPriceExtent(data, options)` returns frozen ascending `[low, high]`
endpoints from complete candles whose `positionAtTime(time)` lies inside the
inclusive `visibleRange`. The callback makes the coordinate system explicit:
use UTC milliseconds for elapsed-time windows, or `slotAtTime` and
`logicalRange` for trading time. Fractional slot windows include only contained
candle centers; partly painted wicks do not change the selection. An undefined
position excludes a row. No records are sorted, mutated, or interpolated.

Missing or nonfinite time/OHLC values skip the whole row. `defined` runs before
any accessor. A finite malformed eligible candle rejects when `low` is above an
open/close or `high` is below one. An empty visible selection returns `undefined`.

```ts
const extent = visibleOhlcPriceExtent(bars, {
  time: "time",
  open: "open",
  high: "high",
  low: "low",
  close: "close",
  positionAtTime: (time) => trading.slotAtTime(time),
  visibleRange: trading.logicalRange,
});
const domain = extent
  ? padLinearDomain(extent, { padding: 0.08, minimumSpan: 0.02 })
  : undefined;
```

`padLinearDomain(domain, { padding, minimumSpan })` applies equal padding on
both sides, defaults to 10% per side, and preserves input direction. It expands
flat domains before padding using `minimumSpan`, or
`max(abs(value) * 0.02, 1)` when no floor is supplied. Inputs and the result
must be finite; the returned frozen endpoints are always distinct. Keep manual
domains as ordinary application state. For logarithmic presentation, first
confirm every visible low is positive, pad the logged domain, and exponentiate;
these helpers do not select a scale mode.

## Fixed-base comparison

`percentageReturns(data, { time, value, baseTime, defined? })` computes cumulative
simple return from an exact common base observation: `(value - base) / base * 100`.
This is change from the base, not the return between adjacent observations.
`indexTo100` accepts the same named inputs and computes `value / base * 100`.
The base maps exactly to 0 or 100; observations are never rounded.

```ts
const comparison = percentageReturns(prices, {
  time: "time",
  value: "close",
  baseTime: Date.UTC(2026, 0, 2, 16),
});
if (comparison) {
  // LineSeries: x="time", y="returnPercent". Use the same baseTime for every asset.
}
```

The result is a frozen source-ordered array of frozen points containing the original
`datum`, `sourceIndex`, `time`, and `returnPercent` or `indexValue`. Datum references
remain caller owned. Missing/nonfinite coordinates or values produce null gaps.
`defined` runs before accessors and excluded rows become gaps. Known missing
observations must be explicit null-value rows; these helpers do not infer a calendar.

`baseTime` must be a safe integer UTC millisecond within the platform Date range.
An absent eligible complete exact base returns `undefined`; render an unavailable
asset status. Multiple eligible complete base records, a nonpositive base price,
or a nonfinite derived result throw. Later finite negative prices remain actual
observations. No nearest-date fallback, per-asset rebasing, sorting or mutation
occurs. Changing the viewport does not change the base.

For percentage labels use `formatNumber(value, { suffix: "%" })`: these values
already express percentage points. An Intl percent formatter would multiply them
by 100 again. Formatting belongs to presentation and uses `Intl.NumberFormat`.

## Candle painting

`CandlestickSeries` accepts original `data`, named `time/open/high/low/close`
accessors, xScale/yScale IDs, `defined`, named `style.body`/`style.wick`, and optional
inspection. Missing/nonfinite fields skip the whole candle. Finite malformed OHLC
rejects with its source index: low must be <= both open/close and high >= both.
Equal open/close paints a centered one-local-unit doji. Body `bandwidth` defaults
to automatic 70% spacing capped at 12, with singleton fallback 8; explicit widths
are positive local units. Body and wick paint are independent. Defaults use teal
for close >= open and coral otherwise; the application may supply its own policy.
Disjoint adjacent equal styles share paths; overlapping records keep sequential
paint, including translucent fills and strokes.

`useCandleInspection(inputs)` owns the same optional capture foundation as volume.
`nearestRecordedCandleX(rendered, { time, filter? })` selects original OHLC (never
interpolates it), adds `timeDelta`, and breaks ties by first source index.
`paintedCandleAt(rendered, { rootPoint })` respects transforms/clips, returns the
last matching source candle and `part: "body" | "wick"`, and tests the body before
its underlying wick. Results preserve captured time/open/high/low/close, original
datum/sourceIndex, close endpoint anchors and body/wick local geometry. Empty
queries return undefined; stale generations throw. The optional typed filter
exposes `anchorInsideClips()` for explicit close-endpoint eligibility.
