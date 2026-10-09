> **Historical status: This October 8, 2026 volume-series proposal was not accepted for implementation and remains outside the shipped inspection API.**

# Plan 008 — remaining Batch 1 design checkpoint

Status: proposal only; no volume-series or related financial API is authorized by
the October 9 inspection shipping decision. CandlestickSeries, TradingTimeScale,
and volume authoring remain separate work requiring their own feedback.

## Minimal volume authoring

Proposed application code, using the existing UTC scale to teach one concept:
columns positioned by numeric timestamps, with an independent volume axis.
The observations below are explicitly deterministic simulation.

```tsx
import { pibbl } from "@pibbl/core";
import { LinearScale, UTCScale, VolumeSeries } from "@pibbl/core/viz";

const start = Date.UTC(2026, 0, 5);
const day = 86_400_000;
const volumes = [
  { time: start, volume: 120 },
  { time: start + day, volume: 80 },
  { time: start + 2 * day, volume: 160 },
];

function VolumeExample() {
  return (
    <UTCScale id="time" domain={[start, start + 2 * day]} range={[30, 270]}>
      <LinearScale id="volume" domain={[0, 200]} range={[170, 30]}>
        <VolumeSeries
          data={volumes}
          time="time"
          volume="volume"
          xScale="time"
          yScale="volume"
          style={{ width: 16, fill: "#087f8c" }}
        />
      </LinearScale>
    </UTCScale>
  );
}

export function mount(canvas: HTMLCanvasElement) {
  return pibbl(canvas, <VolumeExample />);
}
```

VolumeSeries uses numeric/UTC/trading x mappings, unlike BarSeries's categorical
band allocation. It shares calculation and rectangle helpers privately rather
than widening BarSeries with an operation selector. Default column spacing and
width caps follow the accepted candle geometry; explicit `style.width` is in
series-local logical units. No sorting, aggregation, or mutation occurs.

Proposed public signatures (existing types are imported from the public entries):

```ts
interface VolumeSeriesStyle {
  readonly width?: number;
  readonly fill?: FillStyle;
  readonly stroke?: StrokeStyle;
  readonly strokeWidth?: number;
  readonly opacity?: number;
  readonly cursor?: string;
}

interface VolumeSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  readonly data: SignalValue<readonly D[]>;
  readonly time: LineAccessor<D>; // numeric UTC milliseconds
  readonly volume: LineAccessor<D>;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  readonly xScale: ScaleId;
  readonly yScale: ScaleId;
  readonly style?:
    | SignalValue<VolumeSeriesStyle>
    | ((datum: D, index: number, data: readonly D[]) => VolumeSeriesStyle);
  readonly inspection?: VolumeInspectionRef<D>;
}

function VolumeSeries<D>(props: VolumeSeriesProps<D>): PibblNode;
```

Zero is the volume baseline, even when outside the displayed y-domain. Zero
volume remains a recorded observation but paints no rectangle. Nullish/nonfinite
accessor values skip a row; finite negative volume raises an actionable error.
Repeated timestamps preserve source order for ordinary numeric/UTC positioning;
TradingTimeScale retains its accepted unique timestamp input contract. Nearest
selection breaks equal distances by first source index; painted lookup returns
last painted matching column. A skipped row does not shift source indices.

## Financial inspection preserves captured values

Use the existing optional inspection entry and ownership/context implementation.
Do not add financial event objects, subscriptions, registries, or interpolation
of OHLC. Typed operations keep OHLC and volume geometry available without
changing existing numeric query return types.

```ts
interface CandleObservation<D> {
  readonly datum: D;
  readonly sourceIndex: number;
  readonly time: number; // UTC milliseconds
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly anchorLocal: Readonly<RenderedSeriesPoint>; // close endpoint
  readonly anchorRoot: Readonly<RenderedSeriesPoint>;
  readonly bodyBoundsLocal: Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  readonly wickLocal: Readonly<{ x: number; lowY: number; highY: number }>;
}
interface VolumeObservation<D> {
  readonly datum: D;
  readonly sourceIndex: number;
  readonly time: number; // UTC milliseconds
  readonly volume: number;
  readonly baseline: 0;
  readonly anchorLocal: Readonly<RenderedSeriesPoint>; // volume endpoint
  readonly anchorRoot: Readonly<RenderedSeriesPoint>;
  readonly boundsLocal: Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}
interface CandleRenderedSeries<D> {
  readonly observations: readonly CandleObservation<D>[];
  assertLive(): void;
  timeAtRoot(pointRoot: Readonly<RenderedSeriesPoint>): number | undefined;
  anchorInsideClips(pointLocal: Readonly<RenderedSeriesPoint>): boolean;
}
interface VolumeRenderedSeries<D> {
  readonly observations: readonly VolumeObservation<D>[];
  assertLive(): void;
  timeAtRoot(pointRoot: Readonly<RenderedSeriesPoint>): number | undefined;
  anchorInsideClips(pointLocal: Readonly<RenderedSeriesPoint>): boolean;
}
interface CandleInspectionRef<D> {
  rendered(): CandleRenderedSeries<D> | undefined;
}
interface VolumeInspectionRef<D> {
  rendered(): VolumeRenderedSeries<D> | undefined;
}

function useCandleInspection<D>(
  inputs: Pick<
    CandlestickSeriesProps<D>,
    "data" | "time" | "open" | "high" | "low" | "close"
  >,
): CandleInspectionRef<D>;
function useVolumeInspection<D>(
  inputs: Pick<VolumeSeriesProps<D>, "data" | "time" | "volume">,
): VolumeInspectionRef<D>;

interface NearestCandleHit<D> extends CandleObservation<D> {
  readonly timeDelta: number; // absolute UTC milliseconds
}
interface NearestVolumeHit<D> extends VolumeObservation<D> {
  readonly timeDelta: number;
}
interface CandleInspectionCandidate<D> extends CandleObservation<D> {
  anchorInsideClips(): boolean;
}
interface VolumeInspectionCandidate<D> extends VolumeObservation<D> {
  anchorInsideClips(): boolean;
}
interface PaintedVolumeHit<D> extends VolumeObservation<D> {}
interface PaintedCandleHit<D> extends CandleObservation<D> {
  readonly part: "body" | "wick"; // describes the result, not a query selector
}

function nearestRecordedCandleX<D>(
  rendered: CandleRenderedSeries<D>,
  options: {
    time: number;
    filter?: (observation: CandleInspectionCandidate<D>) => boolean;
  },
): NearestCandleHit<D> | undefined;
function nearestRecordedVolumeX<D>(
  rendered: VolumeRenderedSeries<D>,
  options: {
    time: number;
    filter?: (observation: VolumeInspectionCandidate<D>) => boolean;
  },
): NearestVolumeHit<D> | undefined;
function paintedCandleAt<D>(
  rendered: CandleRenderedSeries<D>,
  options: {
    rootPoint: Readonly<RenderedSeriesPoint>;
  },
): PaintedCandleHit<D> | undefined;
function paintedVolumeAt<D>(
  rendered: VolumeRenderedSeries<D>,
  options: {
    rootPoint: Readonly<RenderedSeriesPoint>;
  },
): PaintedVolumeHit<D> | undefined;
```

`timeAtRoot` returns the nearest supplied observation's timestamp on trading
slots, with the earlier observation winning an equal slot distance. UTC mapping
inverts elapsed time normally. Its purpose is selecting a recorded bar; there is
no fabricated timestamp inside a compressed weekend. Singular transforms and
empty mappings return undefined. Queries receive timestamps in UTC milliseconds,
not logical slot indices. Observations outside clips remain eligible for nearest
selection by default; callers explicitly use
`filter: candidate => candidate.anchorInsideClips()` when they want anchor
eligibility. This keeps the optional clip test on a typed candidate, as in
Batch 0; it adds no new string policy.

Borrowed ownership, original datum references, transform capture/rebase, failed
render teardown, and disposal follow Batch 0. Bounds are calculated at paint
and never recomputed from subsequently mutated application records. Painted
queries inverse-transform the root point, apply all clips, and examine visible
body/wick/column geometry in reverse paint order. Dojis use the accepted visible
body geometry; stroke-only bodies include their actual stroke. Within a candle,
`part` follows its actual paint order. Misses return undefined; stale generations
throw. This is geometric receiver-local coverage, without scene occlusion or
pixel-alpha sampling.

## Showcase composition

This component is placed inside the already accepted trading-time provider and
independent price/volume scale providers. `candleInputs` uses the accepted candle
props, including its accepted styling; this proposal does not change them.
`volumeInputs` uses the same records and x-scale ID with a separate y-scale ID.
Color here means close versus open, explicitly labeled in the showcase.

```tsx
function FinancialMarks({ candleInputs, volumeInputs, onPrice, onVolume }) {
  const candles = useCandleInspection(candleInputs);
  const volumes = useVolumeInspection(volumeInputs);
  return (
    <>
      <CandlestickSeries
        {...candleInputs}
        inspection={candles}
        onClick={withInspection((event, context) => {
          const rendered = context.rendered(candles);
          if (!rendered) return;
          const time = rendered.timeAtRoot({ x: event.x, y: event.y });
          if (time === undefined) return;
          const hit = context.request(nearestRecordedCandleX, rendered, {
            time,
          });
          onPrice(hit); // includes captured OHLC, source index, original datum
        })}
      />
      <VolumeSeries
        {...volumeInputs}
        inspection={volumes}
        style={(bar) => ({
          fill: bar.close >= bar.open ? "#087f8c" : "#d9674c",
        })}
        onClick={withInspection((event, context) => {
          const rendered = context.rendered(volumes);
          if (!rendered) return;
          onVolume(
            context.request(paintedVolumeAt, rendered, {
              rootPoint: { x: event.x, y: event.y },
            }),
          );
        })}
      />
    </>
  );
}
```

Nearest price selection and painted volume coverage intentionally teach different
operations. Keyboard actions supply an explicit selected timestamp rather than
inventing pointer coordinates. Identical requests, including misses, use the
existing dispatch memoization. Rendering-only consumers import none of these
query/adapter functions. The runnable Batch 1 showcase will also include a line
and custom marker on the same x mapping, clearly labeled deterministic OHLCV,
mobile layout, and independent minimal demos. Full crosshair/pinning remains
Batch 2, rather than a fourth feature in this batch.

Acceptance requested: VolumeSeries's time-column contract and these explicit
financial inspection operations. Candle authoring and TradingTimeScale are
already accepted and need no renewed approval.
