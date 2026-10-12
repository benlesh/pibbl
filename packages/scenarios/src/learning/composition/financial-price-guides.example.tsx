import { Rectangle, Text, pibbl, useLayoutBox, type PibblController } from "@pibbl/core";
import { CandlestickSeries, LinearScale, ReferenceLine, ScaleAdjust, UTCScale, VolumeSeries, formatNumber } from "@pibbl/core/viz";

const day = 86_400_000;
const bars = [
  { time: Date.UTC(2026, 9, 8), open: 99.4, high: 101.8, low: 98.9, close: 100.8, volume: 920_000 },
  { time: Date.UTC(2026, 9, 9), open: 100.8, high: 103.3, low: 100.1, close: 102.2, volume: 1_260_000 },
  { time: Date.UTC(2026, 9, 12), open: 102.2, high: 105.0, low: 101.7, close: 104.35, volume: 1_640_000 },
] as const;
const price = (value: number) => formatNumber(value, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const volume = (value: number) => formatNumber(value, { notation: "compact", maximumFractionDigits: 1, suffix: " shares" });
function Lesson() {
  const { width, height } = useLayoutBox();
  const left = 18, right = width - 92, top = 72, bottom = height - 38;
  const last = bars.at(-1)!, previous = bars.at(-2)!;
  return <>
    <Rectangle style={{ width, height, fill: "#f6f8fb" }} />
    <Text pointerEvents="none" style={{ left, top: 16, font: "bold 14px sans-serif", fill: "#18283d" }}>Price guides and formatting</Text>
    <Text pointerEvents="none" style={{ left, top: 38, font: "11px sans-serif", fill: "#586b82" }}>{`Last ${price(last.close)} · Previous close ${price(previous.close)} · Volume ${volume(last.volume)}`}</Text>
    <UTCScale id="time" domain={[bars[0]!.time - day / 2, last.time + day / 2]} range={[left, right]}>
      <LinearScale id="price" domain={[97, 107]} range={[bottom, top]}>
        <Rectangle pointerEvents="none" style={{ left, top, width: right - left, height: bottom - top, fill: "#ffffff", stroke: "#d3deeb", strokeWidth: 1 }} />
        <ReferenceLine scale="price" direction="horizontal" value={previous.close} span={[left, right]} style={{ stroke: "#8092aa", strokeWidth: 1, opacity: 0.65 }} />
        <ReferenceLine scale="price" direction="horizontal" value={last.close} span={[left, right]} style={{ stroke: "#00876e", strokeWidth: 1.5 }} />
        <CandlestickSeries data={bars} time="time" open="open" high="high" low="low" close="close" xScale="time" yScale="price" pointerEvents="none" style={(bar) => ({ bandwidth: 26, body: { fill: bar.close >= bar.open ? "#00876e" : "#cb4057" }, wick: { stroke: bar.close >= bar.open ? "#00876e" : "#cb4057" } })} />
        <ScaleAdjust yScale="price" y={last.close}><Text pointerEvents="none" style={{ left: right + 8, top: -6, font: "bold 10px monospace", fill: "#00876e" }}>{price(last.close)}</Text></ScaleAdjust>
        <ScaleAdjust yScale="price" y={previous.close}><Text pointerEvents="none" style={{ left: right + 8, top: -6, font: "10px monospace", fill: "#586b82" }}>{price(previous.close)}</Text></ScaleAdjust>
      </LinearScale>
      <LinearScale id="volume" domain={[0, 1_800_000]} range={[bottom, bottom - 58]}><VolumeSeries data={bars} time="time" volume="volume" xScale="time" yScale="volume" pointerEvents="none" style={{ width: 26, fill: "#6f8fbd" }} /></LinearScale>
    </UTCScale>
    <Text pointerEvents="none" style={{ left, top: height - 16, font: "10px sans-serif", fill: "#586b82" }}>{width < 440 ? "Green: last · gray: previous · simulated USD" : "Solid green: latest supplied close · gray: preceding supplied close · USD / simulated shares"}</Text>
  </>;
}
export default function mount(canvas: HTMLCanvasElement): PibblController { return pibbl(canvas, <Lesson />, { viewport: "responsive" }); }
