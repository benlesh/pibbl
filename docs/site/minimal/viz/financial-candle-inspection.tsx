import { pibbl } from "@pibbl/core";
import {
  CandlestickSeries,
  LinearScale,
  UTCScale,
  type CandlestickSeriesProps,
} from "@pibbl/core/viz";
import {
  nearestRecordedCandleX,
  paintedCandleAt,
  useCandleInspection,
  type CandleInspectionCandidate,
  type CandleInspectionRef,
  type CandleObservation,
  type CandleRenderedSeries,
  type NearestCandleHit,
  type PaintedCandleHit,
} from "@pibbl/core/viz/inspection";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};
const data: readonly Candle[] = [
  { time: Date.UTC(2026, 9, 2), open: 101, high: 105, low: 99, close: 104 },
  { time: Date.UTC(2026, 9, 5), open: 104, high: 106, low: 100, close: 102 },
];
const inputs: Pick<
  CandlestickSeriesProps<Candle>,
  "data" | "time" | "open" | "high" | "low" | "close"
> = {
  data,
  time: "time",
  open: "open",
  high: "high",
  low: "low",
  close: "close",
};
let inspection: CandleInspectionRef<Candle> | undefined;
const result = document.createElement("p");
const button = document.createElement("button");
button.textContent = "Inspect Monday";
const insideCommittedClips = (
  candidate: CandleInspectionCandidate<Candle>,
): boolean => candidate.anchorInsideClips();
button.onclick = () => {
  const rendered: CandleRenderedSeries<Candle> | undefined =
    inspection?.rendered();
  if (!rendered) return;
  const nearest: NearestCandleHit<Candle> | undefined = nearestRecordedCandleX(
    rendered,
    {
      time: data[1]!.time,
      filter: insideCommittedClips,
    },
  );
  const painted: PaintedCandleHit<Candle> | undefined = paintedCandleAt(
    rendered,
    {
      rootPoint: nearest?.anchorRoot ?? { x: 0, y: 0 },
    },
  );
  const observed: CandleObservation<Candle> | undefined = nearest;
  result.textContent = `Close ${observed?.close ?? "none"}; painted ${painted?.part ?? "none"}.`;
};
function Chart() {
  inspection = useCandleInspection(inputs);
  return (
    <CandlestickSeries
      data={inputs.data}
      time={inputs.time}
      open={inputs.open}
      high={inputs.high}
      low={inputs.low}
      close={inputs.close}
      xScale="time"
      yScale="price"
      inspection={inspection}
    />
  );
}
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 180;
document.body.append(canvas, button, result);
const controller = pibbl(
  canvas,
  <UTCScale id="time" domain={[data[0]!.time, data[1]!.time]} range={[30, 290]}>
    <LinearScale id="price" domain={[98, 110]} range={[145, 20]}>
      <Chart />
    </LinearScale>
  </UTCScale>,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
