import { FocusManagement, Group, Overlay, Rectangle, Text, pibbl, useLayoutBox, useSignal, type PibblController } from "@pibbl/core";
import { Axis, CandlestickSeries, GridLines, LinearScale, TradingTimeScale, formatNumber, padLinearDomain, useTradingTimeScale, visibleOhlcPriceExtent } from "@pibbl/core/viz";

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
  const tickCount = height < 150 ? 3 : 5;
  const priceTicks = Array.from({ length: tickCount }, (_, index) => domain[0] + (domain[1] - domain[0]) * index / (tickCount - 1));
  const axisStyle = { font: "10px sans-serif", fill: "#b5c5da", stroke: "#506686" };
  return <LinearScale id="price" domain={domain} range={[height, 0]}>
    <Rectangle pointerEvents="none" style={{ width, height, fill: "#101a2b", stroke: "#2a3950", strokeWidth: 1 }} />
    <GridLines scale="price" direction="horizontal" span={[0, width]} tickValues={priceTicks} style={{ stroke: "#26374f", strokeWidth: 1 }} />
    <CandlestickSeries data={visible} time="time" open="open" high="high" low="low" close="close" xScale="time" yScale="price" pointerEvents="none" style={(bar) => ({ bandwidth: 28, body: { fill: bar.close >= bar.open ? "#29c7ab" : "#ed6975" }, wick: { stroke: bar.close >= bar.open ? "#29c7ab" : "#ed6975" } })} />
    <Axis scale="price" position="left" tickValues={priceTicks} tickFormat={(value) => price(Number(value))} style={axisStyle} />
    <Axis scale="time" position="bottom" tickValues={visible.map((bar) => bar.time)} tickFormat={(value) => `${String(new Date(Number(value)).getUTCDate()).padStart(2, "0")} Oct`} style={axisStyle} />
    <Text pointerEvents="none" style={{ left: 0, top: -14, font: "10px sans-serif", fill: "#b5c5da" }}>Price (USD) · dates in UTC</Text>
    <Text pointerEvents="none" style={{ left: -52, top: -40, font: "11px sans-serif", fill: "#91a2ba" }}>{`${earlier ? "Earlier" : "Recent"} window · ${price(domain[0])}–${price(domain[1])}`}</Text>
  </LinearScale>;
}
function Lesson() {
  const { width, height } = useLayoutBox();
  const earlier = useSignal(false);
  const logicalRange = earlier.get() ? [-0.5, 2.5] as const : [2.5, 4.5] as const;
  return <Group onKeyDown={(event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      earlier.set(event.key === "ArrowLeft");
      event.preventDefault();
    }
  }}>
    <Rectangle keyboardFocusable onClick={() => earlier.update((value) => !value)} style={{ width, height, fill: "#0d1422", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 18, top: 15, font: "bold 14px sans-serif", fill: "#dbe6f1" }}>Visible-window autoscaling</Text>
    <Text pointerEvents="none" style={{ left: 18, top: 55, font: "10px sans-serif", fill: "#91a2ba" }}>The middle candle is extreme; it only changes the domain while visible.</Text>
    <Group style={{ translateX: 70, translateY: 78 }}>
      <Overlay style={{ width: width - 88, height: height - 168 }}>
        <TradingTimeScale id="time" timestamps={bars.map((bar) => bar.time)} logicalRange={logicalRange} range="width" style={{ width: "100%", height: "100%" }}><PricePane earlier={earlier.get()} /></TradingTimeScale>
      </Overlay>
    </Group>
    <Rectangle keyboardFocusable onClick={() => earlier.set(true)} style={{ left: 18, top: height - 54, width: 136, height: 30, fill: earlier.get() ? "#286957" : "#182840", stroke: "#506686", strokeWidth: 1, cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 86, top: height - 44, font: "11px sans-serif", textAlign: "center", fill: "#dbe6f1" }}>← Earlier · 5–7 Oct</Text>
    <Rectangle keyboardFocusable onClick={() => earlier.set(false)} style={{ left: 166, top: height - 54, width: 136, height: 30, fill: earlier.get() ? "#182840" : "#286957", stroke: "#506686", strokeWidth: 1, cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 234, top: height - 44, font: "11px sans-serif", textAlign: "center", fill: "#dbe6f1" }}>Recent · 8–9 Oct →</Text>
    <Text pointerEvents="none" style={{ left: 18, top: height - 14, font: "10px sans-serif", fill: "#dbe6f1" }}>Click chart to switch · ← earlier / → recent</Text>
  </Group>;
}
export default function mount(canvas: HTMLCanvasElement): PibblController { return pibbl(canvas, <FocusManagement><Lesson /></FocusManagement>, { viewport: "responsive" }); }
