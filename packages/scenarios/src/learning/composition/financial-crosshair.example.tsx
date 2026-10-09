import { FocusManagement, Group, Rectangle, Text, pibbl, useLayoutBox, useSignal, type PibblController, type PibblLogicalMouseEvent } from "@pibbl/core";
import { CandlestickSeries, LinearScale, ReferenceLine, ScaleAdjust, TradingTimeScale, VolumeSeries, formatNumber } from "@pibbl/core/viz";
import { nearestRecordedCandleX, useCandleInspection, withInspection } from "@pibbl/core/viz/inspection";

const bars = [
  { time: Date.UTC(2026, 9, 8), open: 100.2, high: 103.1, low: 99.6, close: 102.4, volume: 1_200_000 },
  { time: Date.UTC(2026, 9, 9), open: 102.4, high: 103.3, low: 100.1, close: 101.2, volume: 860_000 },
  { time: Date.UTC(2026, 9, 12), open: 101.2, high: 105.2, low: 100.8, close: 104.35, volume: 1_640_000 },
] as const;
const fmtDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const price = (value: number) => formatNumber(value, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const volume = (value: number) => formatNumber(value, { notation: "compact", maximumFractionDigits: 2 });

function Lesson() {
  const { width, height } = useLayoutBox();
  const candles = useCandleInspection({ data: bars, time: "time", open: "open", high: "high", low: "low", close: "close" });
  const hovered = useSignal<number | undefined>(undefined);
  const pinned = useSignal<number | undefined>(undefined);
  const active = pinned.get() ?? hovered.get() ?? bars.at(-1)!.time;
  const row = bars.find((bar) => bar.time === active) ?? bars.at(-1)!;
  const left = 18, right = width - 18, top = width < 440 ? 84 : 76, middle = height - 82, bottom = height - 26;
  const select = withInspection((event: PibblLogicalMouseEvent, context) => {
    const rendered = context.rendered(candles), time = rendered?.timeAtRoot({ x: event.x, y: event.y });
    if (!rendered || time === undefined) return;
    const hit = context.request(nearestRecordedCandleX, rendered, { time });
    if (hit) hovered.set(hit.time);
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
  return <>
    <Rectangle style={{ width, height, fill: "#0d1422" }} />
    <Text pointerEvents="none" style={{ left, top: 15, font: "bold 14px sans-serif", fill: "#dbe6f1" }}>Snapped OHLCV inspection</Text>
    {width < 440 ? <>
      <Text pointerEvents="none" style={{ left, top: 36, font: "10px sans-serif", fill: "#91a2ba" }}>{fmtDate.format(row.time)}</Text>
      <Text pointerEvents="none" style={{ left: right, top: 36, font: "10px sans-serif", textAlign: "right", fill: pinned.get() === undefined ? "#91a2ba" : "#29c7ab" }}>{pinned.get() === undefined ? "Preview" : "Pinned"}</Text>
      <Text pointerEvents="none" style={{ left, top: 51, font: "9px monospace", fill: "#dbe6f1" }}>{`O ${price(row.open)} H ${price(row.high)} L ${price(row.low)} C ${price(row.close)}`}</Text>
      <Text pointerEvents="none" style={{ left, top: 66, font: "10px sans-serif", fill: "#91a2ba" }}>{`Volume ${volume(row.volume)} shares`}</Text>
    </> : <>
      <Text pointerEvents="none" style={{ left, top: 36, font: "11px sans-serif", fill: "#91a2ba" }}>{`${fmtDate.format(row.time)}  O ${price(row.open)}  H ${price(row.high)}  L ${price(row.low)}  C ${price(row.close)}  V ${volume(row.volume)}`}</Text>
      <Text pointerEvents="none" style={{ left, top: 53, font: "10px sans-serif", fill: pinned.get() === undefined ? "#91a2ba" : "#29c7ab" }}>{pinned.get() === undefined ? "Preview" : "Pinned"}</Text>
    </>}
    <TradingTimeScale id="time" timestamps={bars.map((bar) => bar.time)} logicalRange={[-0.5, 2.5]} range={[left, right]}>
      <LinearScale id="price" domain={[98, 106]} range={[middle - 10, top]}>
        <Rectangle pointerEvents="none" style={{ left, top, width: right - left, height: middle - top - 10, fill: "#101a2b" }} />
        <ReferenceLine scale="price" direction="horizontal" value={row.close} span={[left, right]} style={{ stroke: "#8ea5c5", strokeWidth: 1, opacity: 0.6 }} />
        <Group onMouseMove={select} onMouseLeave={() => hovered.set(undefined)} onClick={pin}>
          <Rectangle keyboardFocusable style={{ left, top, width: right - left, height: middle - top - 10, fill: "transparent", cursor: "crosshair" }} onKeyDown={(event) => { if (event.key === "ArrowLeft") step(-1); else if (event.key === "ArrowRight") step(1); else if (event.key === "Escape") pinned.set(undefined); else return; event.preventDefault(); }} />
          <CandlestickSeries data={bars} time="time" open="open" high="high" low="low" close="close" xScale="time" yScale="price" inspection={candles} pointerEvents="none" style={(bar) => ({ bandwidth: 28, body: { fill: bar.close >= bar.open ? "#29c7ab" : "#ed6975" }, wick: { stroke: bar.close >= bar.open ? "#29c7ab" : "#ed6975" } })} />
        </Group>
      </LinearScale>
      <LinearScale id="volume" domain={[0, 1_800_000]} range={[bottom, middle + 16]}>
        <VolumeSeries data={bars} time="time" volume="volume" xScale="time" yScale="volume" pointerEvents="none" style={{ width: 28, fill: "#6f8fbd", opacity: 0.7 }} />
      </LinearScale>
      <ReferenceLine scale="time" direction="vertical" value={active} span={[top, bottom]} style={{ stroke: "#dbe6f1", strokeWidth: 1, opacity: 0.72 }} />
      <ScaleAdjust xScale="time" x={active}><Text pointerEvents="none" style={{ left: 0, top: bottom + 2, font: "10px sans-serif", textAlign: "center", fill: "#dbe6f1" }}>selected</Text></ScaleAdjust>
    </TradingTimeScale>
    <Text pointerEvents="none" style={{ left, top: height - 14, font: "10px sans-serif", fill: "#91a2ba" }}>{width < 440 ? "Tap pin · ← → step · Esc unpin" : "Move to inspect · click/tap to pin · ← → step · Esc unpin"}</Text>
  </>;
}
export default function mount(canvas: HTMLCanvasElement): PibblController { return pibbl(canvas, <FocusManagement><Lesson /></FocusManagement>, { viewport: "responsive" }); }
