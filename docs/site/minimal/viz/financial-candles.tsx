import { pibbl } from "@pibbl/core";
import {
  CandlestickSeries,
  LinearScale,
  UTCScale,
  type CandleBodyStyle,
  type CandlestickSeriesProps,
  type CandlestickSeriesStyle,
  type CandleWickStyle,
} from "@pibbl/core/viz";

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
  { time: Date.UTC(2026, 9, 6), open: 102, high: 108, low: 101, close: 107 },
];
const props: CandlestickSeriesProps<Candle> = {
  data,
  time: "time",
  open: "open",
  high: "high",
  low: "low",
  close: "close",
  xScale: "time",
  yScale: "price",
};
const body: CandleBodyStyle = {
  fill: "#0f766e",
  stroke: "#134e4a",
  strokeWidth: 1,
};
const wick: CandleWickStyle = { stroke: "#173a35", strokeWidth: 1 };
const style: CandlestickSeriesStyle = { bandwidth: "auto", body, wick };

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 180;
document.body.append(canvas);
const controller = pibbl(
  canvas,
  <UTCScale id="time" domain={[data[0]!.time, data[2]!.time]} range={[30, 290]}>
    <LinearScale id="price" domain={[98, 110]} range={[145, 20]}>
      <CandlestickSeries
        data={props.data}
        time={props.time}
        open={props.open}
        high={props.high}
        low={props.low}
        close={props.close}
        xScale={props.xScale}
        yScale={props.yScale}
        style={style}
      />
    </LinearScale>
  </UTCScale>,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
