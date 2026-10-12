import {
  LinearScale,
  OhlcBarSeries,
  UTCScale,
  type OhlcBarSeriesProps,
} from "@pibbl/core/viz";
import { useOhlcBarInspection } from "@pibbl/core/viz/inspection";

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
function Bars() {
  const inspection = useOhlcBarInspection(props);
  return (
    <OhlcBarSeries
      {...props}
      inspection={inspection}
      style={(row) => ({
        bandwidth: 8,
        stroke: row.close >= row.open ? "#00876e" : "#cb4057",
        strokeWidth: 1.2,
      })}
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
