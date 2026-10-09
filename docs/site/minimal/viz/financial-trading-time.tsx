import { Circle, Text, pibbl } from "@pibbl/core";
import {
  LineSeries,
  LinearScale,
  PlotSeries,
  TradingTimeScale,
  useTradingTimeScale,
  type ResolvedTradingTimeScale,
  type TradingTimeScaleProps,
} from "@pibbl/core/viz";

type Quote = { id: string; time: number; price: number };
const quotes: readonly Quote[] = [
  { id: "fri", time: Date.UTC(2026, 9, 2, 16), price: 101 },
  { id: "mon", time: Date.UTC(2026, 9, 5, 9, 30), price: 104 },
  { id: "tue", time: Date.UTC(2026, 9, 6, 9, 30), price: 103 },
];
const scale: TradingTimeScaleProps = {
  id: "session",
  timestamps: quotes.map((quote) => quote.time),
  range: [30, 290],
};
function SlotLabel() {
  const resolved: ResolvedTradingTimeScale =
    useTradingTimeScale("session").get();
  return (
    <Text
      pointerEvents="none"
      style={{ left: 8, top: 165, font: "12px sans-serif", fill: "#173a35" }}
    >{`Fri → Mon → Tue · slots 0 → ${resolved.slotAtTime(quotes[1]!.time)} → 2`}</Text>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 190;
document.body.append(canvas);
const controller = pibbl(
  canvas,
  <TradingTimeScale
    id={scale.id}
    timestamps={scale.timestamps}
    range={scale.range}
  >
    <LinearScale id="price" domain={[98, 106]} range={[145, 25]}>
      <LineSeries
        data={quotes}
        x="time"
        y="price"
        xScale="session"
        yScale="price"
        style={{ stroke: "#087f8c" }}
      />
      <PlotSeries
        data={quotes}
        x="time"
        y="price"
        xScale="session"
        yScale="price"
        keyBy="id"
        render={() => <Circle style={{ radius: 4, fill: "#e85d3f" }} />}
      />
      <SlotLabel />
    </LinearScale>
  </TradingTimeScale>,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
