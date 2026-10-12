import {
  LinearScale,
  OhlcBarSeries,
  UTCScale,
  type OhlcBarSeriesProps,
  type OhlcBarSeriesStyle,
} from "@pibbl/core/viz";
import {
  nearestRecordedOhlcBarX,
  paintedOhlcBarAt,
  useOhlcBarInspection,
  type NearestOhlcBarHit,
  type OhlcBarInspectionCandidate,
  type OhlcBarInspectionRef,
  type OhlcBarObservation,
  type OhlcBarRenderedSeries,
  type PaintedOhlcBarHit,
} from "@pibbl/core/viz/inspection";

interface Price {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
const prices: readonly Price[] = [
  { time: 1_000, open: 10, high: 14, low: 8, close: 12 },
];
const props: OhlcBarSeriesProps<Price> = {
  data: prices,
  time: "time",
  open: "open",
  high: "high",
  low: "low",
  close: "close",
  xScale: "time",
  yScale: "price",
};
const style: OhlcBarSeriesStyle = {
  bandwidth: 8,
  stroke: "#00876e",
  strokeWidth: 1.2,
};
const insideCommittedClips = (
  candidate: OhlcBarInspectionCandidate<Price>,
): boolean => candidate.anchorInsideClips();
function inspectCommitted(inspection: OhlcBarInspectionRef<Price>):
  | Readonly<{
      observation: OhlcBarObservation<Price> | undefined;
      nearest: NearestOhlcBarHit<Price> | undefined;
      painted: PaintedOhlcBarHit<Price> | undefined;
    }>
  | undefined {
  const rendered: OhlcBarRenderedSeries<Price> | undefined =
    inspection.rendered();
  if (!rendered) return undefined;
  const nearest: NearestOhlcBarHit<Price> | undefined = nearestRecordedOhlcBarX(
    rendered,
    {
      time: prices[0]!.time,
      filter: insideCommittedClips,
    },
  );
  const observation: OhlcBarObservation<Price> | undefined = nearest;
  const painted: PaintedOhlcBarHit<Price> | undefined = nearest
    ? paintedOhlcBarAt(rendered, { rootPoint: nearest.anchorRoot })
    : undefined;
  return { observation, nearest, painted };
}
function Bars() {
  const inspection: OhlcBarInspectionRef<Price> = useOhlcBarInspection(props);
  return (
    <OhlcBarSeries
      {...props}
      inspection={inspection}
      onClick={() => void inspectCommitted(inspection)}
      style={style}
    />
  );
}
export function FinancialOhlcBars() {
  return (
    <UTCScale id="time" domain={[0, 2_000]} range={[0, 100]}>
      <LinearScale id="price" domain={[0, 20]} range={[100, 0]}>
        <Bars />
      </LinearScale>
    </UTCScale>
  );
}
