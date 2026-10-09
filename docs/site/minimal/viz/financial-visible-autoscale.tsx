import { CandlestickSeries, LinearScale, TradingTimeScale, padLinearDomain, useTradingTimeScale, visibleOhlcPriceExtent } from "@pibbl/core/viz";
import { Rectangle, Text, pibbl } from "@pibbl/core";
const bars = [{ time: Date.UTC(2026, 9, 5), open: 100, high: 103, low: 99, close: 102 }, { time: Date.UTC(2026, 9, 6), open: 102, high: 150, low: 50, close: 103 }, { time: Date.UTC(2026, 9, 7), open: 103, high: 104, low: 100, close: 102 }];
function Price() {
  const scale = useTradingTimeScale("time").get();
  const extent = visibleOhlcPriceExtent(bars, { time: "time", open: "open", high: "high", low: "low", close: "close", positionAtTime: (time) => scale.slotAtTime(time), visibleRange: scale.logicalRange });
  const visible = bars.filter((bar) => {
    const slot = scale.slotAtTime(bar.time)!;
    return slot >= Math.min(...scale.logicalRange) && slot <= Math.max(...scale.logicalRange);
  });
  return <LinearScale id="price" domain={padLinearDomain(extent!)} range={[165, 40]}>
    <Rectangle style={{ left: 30, top: 40, width: 260, height: 125, fill: "#f6f8fb" }} />
    <Text style={{ left: 30, top: 12, font: "11px sans-serif", fill: "#18283d" }}>Only the final candle is visible; the middle extreme is excluded.</Text>
    <CandlestickSeries data={visible} time="time" open="open" high="high" low="low" close="close" xScale="time" yScale="price" />
  </LinearScale>;
}
const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 190; document.body.append(canvas);
const controller = pibbl(canvas, <TradingTimeScale id="time" timestamps={bars.map((bar) => bar.time)} logicalRange={[1.5, 2.5]} range={[30, 290]}><Price /></TradingTimeScale>);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
