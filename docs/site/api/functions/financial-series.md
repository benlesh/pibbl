---
id: api-function-financial-series
title: Financial series
summary: Render and inspect original financial observations and compare cumulative returns from an exact common base.
kind: api
slug: financial-series
apiCategory: function
symbols:
  [
    OhlcvBucket,
    OhlcvSource,
    AggregateOhlcvOptions,
    AggregatedOhlcvPoint,
    SessionAccessor,
    SessionIdentifier,
    SessionVwapOptions,
    SessionVwapPoint,
    aggregateOhlcv,
    sessionVwap,
    ComparisonBaseOptions,
    PercentageReturnPoint,
    IndexedValuePoint,
    percentageReturns,
    indexTo100,
    MovingAverageOptions,
    BollingerBandsOptions,
    MovingAveragePoint,
    BollingerBandPoint,
    simpleMovingAverage,
    exponentialMovingAverage,
    bollingerBands,
    OscillatorOptions,
    RelativeStrengthIndexOptions,
    MovingAverageConvergenceDivergenceOptions,
    StochasticOscillatorOptions,
    RelativeStrengthIndexPoint,
    MovingAverageConvergenceDivergencePoint,
    StochasticOscillatorPoint,
    relativeStrengthIndex,
    movingAverageConvergenceDivergence,
    stochasticOscillator,
    BaselineSeries,
    BaselineSeriesProps,
    BaselineSeriesStyle,
    BaselineSideStyle,
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
    OhlcBarSeries,
    OhlcBarSeriesProps,
    OhlcBarSeriesStyle,
    useOhlcBarInspection,
    nearestRecordedOhlcBarX,
    paintedOhlcBarAt,
    OhlcBarObservation,
    OhlcBarInspectionCandidate,
    NearestOhlcBarHit,
    PaintedOhlcBarHit,
    OhlcBarInspectionRef,
    OhlcBarRenderedSeries,
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

## Consecutive-window indicators

`simpleMovingAverage(data, { value, period, defined? })` and
`exponentialMovingAverage(data, { value, period, defined? })` return frozen,
source-aligned `MovingAveragePoint` rows with `datum`, `sourceIndex`, and
`average`. `period` is a positive safe integer. A result stays `null` until the
window contains `period` consecutive eligible finite values. Missing, nonfinite,
and excluded rows return `null` and reset warmup; `defined` runs before `value`.

SMA uses the trailing arithmetic mean. EMA seeds with that first complete SMA and
then uses `2 / (period + 1)` as its smoothing factor. These helpers do not fill
gaps, choose dates, sort data, or mutate source rows.

`bollingerBands(data, { value, period, multiplier?, defined? })` uses the same
consecutive windows and returns frozen `BollingerBandPoint` rows with `mean`,
`lower`, and `upper`. It uses population standard deviation and a finite
non-negative `multiplier`, defaulting to `2`. A band result is null during warmup
or after a reset. Derived nonfinite values reject rather than silently clip.

```ts
const bands = bollingerBands(prices, {
  value: "close",
  period: 20,
  multiplier: 2,
});
// LineSeries: y="mean", y="lower", or y="upper".
```

## Oscillators

`relativeStrengthIndex(data, { value, period, defined? })` returns frozen,
source-aligned `RelativeStrengthIndexPoint` rows. Wilder smoothing seeds after
`period` consecutive price changes, so the first value needs `period + 1`
consecutive prices. Flat gains and losses yield `50`; gain-only and loss-only
windows yield `100` and `0`. Gaps reset the seed.

`movingAverageConvergenceDivergence(data, { value, fastPeriod, slowPeriod,
signalPeriod, defined? })` returns aligned `macd`, `signal`, and `histogram`
fields. The fast period must be smaller than the slow period. Both price EMAs
use SMA seeds; MACD appears once both are available, while the signal and
histogram wait for `signalPeriod` MACD values.

`stochasticOscillator(data, { high, low, close, lookbackPeriod, kPeriod,
dPeriod, defined? })` returns `rawK`, smoothed `k`, and `d` fields. All periods
are positive safe integers. Every finite candle must satisfy `low <= close <= high`.
A zero trailing range returns null and resets only %K/%D smoothing, preserving
the complete OHLC row in the rolling range. Missing, nonfinite, and excluded
records reset warmup in every oscillator; accessors run only after `defined`.

```ts
const rsi = relativeStrengthIndex(prices, { value: "close", period: 14 });
const macd = movingAverageConvergenceDivergence(prices, {
  value: "close",
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
});
const stochastic = stochasticOscillator(candles, {
  high: "high",
  low: "low",
  close: "close",
  lookbackPeriod: 14,
  kPeriod: 3,
  dPeriod: 3,
});
```

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

## OHLC bars

`OhlcBarSeries` accepts the same original `data`, `time/open/high/low/close`,
scales, `defined`, event, pointer, and inspection inputs as `CandlestickSeries`.
It paints a high/low stem, a left-facing open tick, and a right-facing close tick.
Its shared style accepts `bandwidth`, `stroke`, `strokeWidth`, `opacity`, and
`cursor`; a callback receives the original datum, source index, and complete data.
Missing/nonfinite values skip the complete bar and finite malformed OHLC rejects.

`useOhlcBarInspection(inputs)` captures original data and evaluated OHLC values.
`nearestRecordedOhlcBarX(rendered, { time, filter? })` returns the nearest original
bar with `timeDelta`. `paintedOhlcBarAt(rendered, { rootPoint })` respects committed
transforms and clips and returns `part: "stem" | "openTick" | "closeTick"` for the
last painted matching segment. Results retain original datum/sourceIndex, close
anchors, and frozen local stem/open/close tick geometry; stale generations throw.

## Entry-price baseline series

`BaselineSeries` draws linear connections with independently colored lines and
filled regions above and below an explicit finite data-space `baseline`. It uses
`data`, `x`, `y`, `xScale`, `yScale`, `defined`, and optional numeric `inspection`.
`baseline` and data can be signals. Missing/nonfinite observations split runs;
synthetic crossing geometry never becomes an inspection observation.

`style.above` and `style.below` accept `fill` and `stroke` paints.
`fillOpacity` defaults to `0.2` and affects only fills; `strokeWidth` defaults to
`2`. Equal values use the above stroke and have no area. Linear interpolation is
explicit; there is no curve-selection option in this initial component.

```tsx
<BaselineSeries
  data={prices}
  x="time"
  y="close"
  xScale="time"
  yScale="price"
  baseline={entryPrice}
  style={{
    above: { fill: "#29c7ab", stroke: "#00876e" },
    below: { fill: "#ed6975", stroke: "#cb4057" },
    fillOpacity: 0.22,
    strokeWidth: 1.5,
  }}
/>
```

Financial event markers compose existing `PlotSeries` with application-owned
keyed glyphs, labels and focusable hit regions. The application owns fill
selection, coincident-event ordering and clipping policy. Execution Journal
shows this composition with simulated buy/sell fills and a selectable entry
baseline; it does not add a public marker component.

## OHLCV aggregation and session VWAP

`aggregateOhlcv(data, options)` preserves chronological source order and combines
complete records within explicit half-open `{ start, end }` buckets. Accessors
supply `time`, `open`, `high`, `low`, `close`, and `volume`; `bucket(time)` supplies
bounds or `null` to exclude a timestamp. `defined` excludes before accessors run.
First open, maximum high, minimum low, last close and summed volume form each
frozen `AggregatedOhlcvPoint`. Frozen `sources` retain original datum/index pairs.
It creates no empty buckets and does not determine whether a bucket is final.
Missing inputs skip; descending finite times, inconsistent/overlapping bounds,
malformed finite OHLC, negative volume and volume overflow reject. Source records
remain caller-owned and are not frozen or mutated.

`sessionVwap(data, { price, volume, session, defined? })` returns one frozen point
per original record. Session IDs are strings or finite numbers supplied by a
property or callback. Every session change resets accumulation, including an
excluded first observation. Session resolves before `defined`; excluded rows skip
price and volume accessors, report their session and produce null VWAP. Missing
price/volume also produces null while preserving that session's prior state.
Zero volume preserves prior VWAP, or null before the first positive volume.
Negative volume and cumulative volume overflow reject. Weighted price arithmetic
avoids intermediate price-times-volume overflow. Results include original datum,
sourceIndex, session, cumulativeVolume and vwap. The function does not infer a
calendar, reorder data or deduplicate observations.

Trade price and quantity produce trade-based VWAP. Typical bar price
`(high + low + close) / 3` and bar volume produce an approximation; the caller must
label that choice. Derive VWAP from the full source session before slicing the
view or aggregating the display timeframe to preserve a consistent study.

Live updates use ordinary signals: replace the current immutable record or append
a new record and publish the new array. The application owns feed lifetime,
retention, follow-latest policy and historical inspection. Existing chart and
animation APIs continue to own rendering and navigation.
