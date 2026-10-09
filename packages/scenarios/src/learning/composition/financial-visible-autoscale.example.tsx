import { FocusManagement, Rectangle, Text, pibbl, useLayoutBox, useSignal, type PibblController } from "@pibbl/core";
import { CandlestickSeries, LinearScale, TradingTimeScale, formatNumber, padLinearDomain, useTradingTimeScale, visibleOhlcPriceExtent } from "@pibbl/core/viz";

const bars = [
  { time: Date.UTC(2026, 9, 5), open: 100, high: 103, low: 99, close: 102 },
  { time: Date.UTC(2026, 9, 6), open: 102, high: 104, low: 101, close: 103 },
  { time: Date.UTC(2026, 9, 7), open: 103, high: 156, low: 45, close: 102 },
  { time: Date.UTC(2026, 9, 8), open: 102, high: 104, low: 100, close: 101 },
  { time: Date.UTC(2026, 9, 9), open: 101, high: 103, low: 99, close: 102 },
] as const;
const price = (value: number) => formatNumber(value, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
function PricePane({ earlier }: { earlier: boolean }) {
  const { width, height } = useLayoutBox();
  const scale = useTradingTimeScale("time").get();
  const extent = visibleOhlcPriceExtent(bars, { time: "time", open: "open", high: "high", low: "low", close: "close", positionAtTime: (time) => scale.slotAtTime(time), visibleRange: scale.logicalRange });
  const domain = padLinearDomain(extent!, { padding: 0.1 });
  const visible = bars.filter((bar) => {
    const slot = scale.slotAtTime(bar.time)!;
    return slot >= Math.min(...scale.logicalRange) && slot <= Math.max(...scale.logicalRange);
  });
  const left = 18, right = width - 18, top = 65, bottom = height - 32;
  return <LinearScale id="price" domain={domain} range={[bottom, top]}>
    <Rectangle pointerEvents="none" style={{ left, top, width: right - left, height: bottom - top, fill: "#101a2b", stroke: "#2a3950", strokeWidth: 1 }} />
    <CandlestickSeries data={visible} time="time" open="open" high="high" low="low" close="close" xScale="time" yScale="price" pointerEvents="none" style={(bar) => ({ bandwidth: 28, body: { fill: bar.close >= bar.open ? "#29c7ab" : "#ed6975" }, wick: { stroke: bar.close >= bar.open ? "#29c7ab" : "#ed6975" } })} />
    <Text pointerEvents="none" style={{ left, top: 38, font: "11px sans-serif", fill: "#91a2ba" }}>{`${earlier ? "Earlier" : "Recent"} window · ${price(domain[0])}–${price(domain[1])}`}</Text>
  </LinearScale>;
}
function Lesson() {
  const { width, height } = useLayoutBox();
  const earlier = useSignal(false);
  const logicalRange = earlier.get() ? [-0.5, 2.5] as const : [2.5, 4.5] as const;
  return <>
    <Rectangle style={{ width, height, fill: "#0d1422" }} />
    <Text pointerEvents="none" style={{ left: 18, top: 15, font: "bold 14px sans-serif", fill: "#dbe6f1" }}>Visible-window autoscaling</Text>
    <Text pointerEvents="none" style={{ left: 18, top: 55, font: "10px sans-serif", fill: "#91a2ba" }}>The middle candle is extreme; it only changes the domain while visible.</Text>
    <TradingTimeScale id="time" timestamps={bars.map((bar) => bar.time)} logicalRange={logicalRange} range={[18, width - 18]}><PricePane earlier={earlier.get()} /></TradingTimeScale>
    <Rectangle keyboardFocusable onClick={() => earlier.update((value) => !value)} onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Enter") { earlier.update((value) => !value); event.preventDefault(); } }} style={{ left: 18, top: height - 24, width: width - 36, height: 18, fill: "transparent", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 18, top: height - 18, font: "10px sans-serif", fill: "#dbe6f1" }}>← → or click: switch visible window</Text>
  </>;
}
export default function mount(canvas: HTMLCanvasElement): PibblController { return pibbl(canvas, <FocusManagement><Lesson /></FocusManagement>, { viewport: "responsive" }); }
