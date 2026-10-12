import { FocusManagement, Group, Rectangle, Text, pibbl, useSignal, type PibblLogicalMouseEvent } from "@pibbl/core";
import { CandlestickSeries, LinearScale, ReferenceLine, TradingTimeScale, VolumeSeries, formatNumber } from "@pibbl/core/viz";
import { nearestRecordedCandleX, useCandleInspection, withInspection } from "@pibbl/core/viz/inspection";
const bars = [
  { time: Date.UTC(2026, 9, 8), open: 100, high: 103, low: 99, close: 102, volume: 1_200_000 },
  { time: Date.UTC(2026, 9, 9), open: 102, high: 104, low: 100, close: 101, volume: 860_000 },
  { time: Date.UTC(2026, 9, 12), open: 101, high: 105, low: 100, close: 104, volume: 1_640_000 },
];
const price = (value: number) => formatNumber(value, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const volume = (value: number) => formatNumber(value, { notation: "compact" });
function Chart() {
  const candles = useCandleInspection({ data: bars, time: "time", open: "open", high: "high", low: "low", close: "close" });
  const preview = useSignal<number | undefined>(undefined), pinned = useSignal<number | undefined>(undefined);
  const active = pinned.get() ?? preview.get() ?? bars.at(-1)!.time, row = bars.find((bar) => bar.time === active)!;
  const inspect = withInspection((event: PibblLogicalMouseEvent, context) => {
    const rendered = context.rendered(candles), time = rendered?.timeAtRoot({ x: event.x, y: event.y });
    if (!rendered || time === undefined) return;
    const hit = context.request(nearestRecordedCandleX, rendered, { time });
    if (hit) preview.set(hit.time);
  });
  const pin = withInspection((event: PibblLogicalMouseEvent, context) => {
    const rendered = context.rendered(candles), time = rendered?.timeAtRoot({ x: event.x, y: event.y });
    if (!rendered || time === undefined) return;
    const hit = context.request(nearestRecordedCandleX, rendered, { time });
    if (hit) pinned.update((value) => value === hit.time ? undefined : hit.time);
  });
  const step = (direction: number) => {
    const index = bars.findIndex((bar) => bar.time === active);
    pinned.set(bars[Math.max(0, Math.min(bars.length - 1, index + direction))]!.time);
  };
  return <TradingTimeScale id="time" timestamps={bars.map((bar) => bar.time)} logicalRange={[-0.5, 2.5]} range={[30, 290]}>
    <Text pointerEvents="none" style={{ left: 30, top: 8, font: "11px sans-serif", fill: "#18283d" }}>{`O ${price(row.open)} H ${price(row.high)} L ${price(row.low)} C ${price(row.close)} V ${volume(row.volume)}`}</Text>
    <LinearScale id="price" domain={[98, 106]} range={[135, 30]}><Group onMouseMove={inspect} onMouseLeave={() => preview.set(undefined)} onClick={pin}>
      <Rectangle keyboardFocusable onKeyDown={(event) => { if (event.key === "ArrowLeft") step(-1); else if (event.key === "ArrowRight") step(1); else if (event.key === "Escape") pinned.set(undefined); else return; event.preventDefault(); }} style={{ left: 30, top: 30, width: 260, height: 105, fill: "transparent", cursor: "crosshair" }} />
      <CandlestickSeries data={bars} time="time" open="open" high="high" low="low" close="close" xScale="time" yScale="price" inspection={candles} pointerEvents="none" />
    </Group></LinearScale>
    <LinearScale id="volume" domain={[0, 1_800_000]} range={[170, 145]}><VolumeSeries data={bars} time="time" volume="volume" xScale="time" yScale="volume" pointerEvents="none" /></LinearScale>
    <ReferenceLine scale="time" direction="vertical" value={active} span={[30, 170]} style={{ stroke: "#18283d" }} />
  </TradingTimeScale>;
}
const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 190; document.body.append(canvas);
const controller = pibbl(canvas, <FocusManagement><Chart /></FocusManagement>);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
