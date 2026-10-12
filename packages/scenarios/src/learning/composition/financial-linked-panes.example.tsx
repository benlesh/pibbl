import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useLayoutBox,
  useSignal,
  type PibblController,
  type PibblLogicalMouseEvent,
} from "@pibbl/core";
import {
  Axis,
  CandlestickSeries,
  GridLines,
  LinearScale,
  ReferenceLine,
  TradingTimeScale,
  VolumeSeries,
  formatNumber,
} from "@pibbl/core/viz";
import {
  nearestRecordedCandleX,
  useCandleInspection,
  withInspection,
} from "@pibbl/core/viz/inspection";

const rows = (() => {
  const result: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[] = [];
  let time = Date.UTC(2026, 0, 2, 16),
    close = 104.2;
  for (let index = 0; result.length < 52; index += 1) {
    const day = new Date(time).getUTCDay();
    time += 86_400_000;
    if (day === 0 || day === 6) continue;
    const shock =
      index === 21
        ? -5.7
        : index === 34
          ? 4.9
          : Math.sin(index * 1.71) * 1.45 + Math.cos(index * 0.47) * 0.72;
    const open = close,
      next = Math.max(82, open + shock),
      high = Math.max(open, next) + 0.7 + (index % 4) * 0.24,
      low = Math.min(open, next) - 0.65 - (index % 3) * 0.3;
    result.push({
      time: time - 86_400_000,
      open,
      high,
      low,
      close: next,
      volume: Math.round(
        780_000 + Math.abs(shock) * 310_000 + (index % 7) * 91_000,
      ),
    });
    close = next;
  }
  return result;
})();
const date = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const money = (value: number) =>
  formatNumber(value, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
const shares = (value: number) =>
  formatNumber(value, { notation: "compact", maximumFractionDigits: 1 });

function Lesson() {
  const { width, height } = useLayoutBox();
  const selected = useSignal(rows.at(-1)!.time);
  const inspection = useCandleInspection({
    data: rows,
    time: "time",
    open: "open",
    high: "high",
    low: "low",
    close: "close",
  });
  const left = 54,
    right = width - 18,
    top = width < 440 ? 83 : 72,
    split = Math.max(top + 68, height - 82),
    bottom = height - 42;
  const active = rows.find((row) => row.time === selected.get())!;
  const choose = withInspection((event: PibblLogicalMouseEvent, context) => {
    const rendered = context.rendered(inspection);
    const time = rendered?.timeAtRoot({ x: event.x, y: event.y });
    if (!rendered || time === undefined) return;
    const hit = context.request(nearestRecordedCandleX, rendered, { time });
    if (hit) selected.set(hit.time);
  });
  const key = (event: { key: string; preventDefault(): void }) => {
    const index = rows.findIndex((row) => row.time === selected.get());
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    selected.set(
      rows[
        Math.max(
          0,
          Math.min(
            rows.length - 1,
            index + (event.key === "ArrowLeft" ? -1 : 1),
          ),
        )
      ]!.time,
    );
    event.preventDefault();
  };
  return (
    <>
      <Rectangle style={{ width, height, fill: "#0d1422" }} />
      <Text
        pointerEvents="none"
        style={{
          left: 16,
          top: 14,
          font: "bold 14px sans-serif",
          fill: "#dbe6f1",
        }}
      >
        Northstar Materials · daily OHLCV
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 16,
          top: 34,
          font: width < 440 ? "9px sans-serif" : "10px sans-serif",
          fill: "#91a2ba",
        }}
      >
        {width < 440
          ? `${date.format(active.time)} · O ${money(active.open)} H ${money(active.high)} L ${money(active.low)} C ${money(active.close)}`
          : `${date.format(active.time)} · O ${money(active.open)} H ${money(active.high)} L ${money(active.low)} C ${money(active.close)} · ${shares(active.volume)} shares`}
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 16,
          top: width < 440 ? 48 : 49,
          font: "9px sans-serif",
          fill: "#91a2ba",
        }}
      >
        {width < 440
          ? `${shares(active.volume)} shares · deterministic simulation`
          : "Irregular deterministic simulation · not a live feed"}
      </Text>
      {width < 440 && (
        <Text
          pointerEvents="none"
          style={{ left: 16, top: 61, font: "9px sans-serif", fill: "#91a2ba" }}
        >
          Not a live feed · recorded UTC sessions
        </Text>
      )}
      <TradingTimeScale
        id="time"
        timestamps={rows.map((row) => row.time)}
        logicalRange={[-0.5, rows.length - 0.5]}
        range={[left, right]}
      >
        <LinearScale id="price" domain={[85, 125]} range={[split - 12, top]}>
          <Rectangle
            pointerEvents="none"
            style={{
              left,
              top,
              width: right - left,
              height: split - top - 12,
              fill: "#101a2b",
              stroke: "#273852",
              strokeWidth: 1,
            }}
          />
          <GridLines
            scale="price"
            direction="horizontal"
            span={[left, right]}
            tickValues={[90, 100, 110]}
            style={{ stroke: "#273852", strokeWidth: 0.5 }}
          />
          <Text
            pointerEvents="none"
            style={{
              left: left + 4,
              top: top + 4,
              font: "10px sans-serif",
              fill: "#91a2ba",
            }}
          >
            USD
          </Text>
          <Group style={{ translateX: left }}>
            <Axis
              scale="price"
              position="left"
              tickValues={[90, 100, 110]}
              tickFormat={(value) =>
                `$${formatNumber(Number(value), { maximumFractionDigits: 0 })}`
              }
              style={{ font: "10px sans-serif", fill: "#91a2ba" }}
            />
          </Group>
          <Group onMouseMove={choose} onClick={choose}>
            <CandlestickSeries
              data={rows}
              time="time"
              open="open"
              high="high"
              low="low"
              close="close"
              xScale="time"
              yScale="price"
              inspection={inspection}
              pointerEvents="none"
              style={(row) => ({
                body: { fill: row.close >= row.open ? "#29c7ab" : "#ed6975" },
                wick: { stroke: row.close >= row.open ? "#29c7ab" : "#ed6975" },
              })}
            />
            <Rectangle
              keyboardFocusable
              onKeyDown={key}
              style={{
                left,
                top,
                width: right - left,
                height: split - top - 12,
                fill: "transparent",
                cursor: "crosshair",
              }}
            />
          </Group>
        </LinearScale>
        <LinearScale
          id="volume"
          domain={[0, 3_000_000]}
          range={[bottom, split + 9]}
        >
          <Rectangle
            pointerEvents="none"
            style={{
              left,
              top: split + 9,
              width: right - left,
              height: bottom - split - 9,
              fill: "#101a2b",
            }}
          />
          <Text
            pointerEvents="none"
            style={{
              left: left + 4,
              top: split + 11,
              font: "9px sans-serif",
              fill: "#91a2ba",
            }}
          >
            shares
          </Text>
          <Group style={{ translateX: left }}>
            <Axis
              scale="volume"
              position="left"
              tickValues={[0, 1_000_000]}
              tickFormat={(value) =>
                `${formatNumber(Number(value) / 1_000_000, { maximumFractionDigits: 0 })}M`
              }
              style={{ font: "10px sans-serif", fill: "#91a2ba" }}
            />
          </Group>
          <Group onMouseMove={choose} onClick={choose}>
            <VolumeSeries
              data={rows}
              time="time"
              volume="volume"
              xScale="time"
              yScale="volume"
              pointerEvents="none"
              style={{
                width: Math.min(12, ((right - left) / rows.length) * 0.7),
                fill: "#6f8fbd",
                opacity: 0.75,
              }}
            />
            <Rectangle
              keyboardFocusable
              onKeyDown={key}
              style={{
                left,
                top: split + 9,
                width: right - left,
                height: bottom - split - 9,
                fill: "transparent",
                cursor: "crosshair",
              }}
            />
          </Group>
        </LinearScale>
        <ReferenceLine
          scale="time"
          direction="vertical"
          value={active.time}
          span={[top, bottom]}
          style={{ stroke: "#dbe6f1", strokeWidth: 1, opacity: 0.75 }}
        />
        <Group style={{ translateY: bottom - height }}>
          <Axis
            scale="time"
            position="bottom"
            tickValues={[
              rows[0]!.time,
              rows[Math.floor(rows.length / 2)]!.time,
              rows.at(-1)!.time,
            ]}
            tickFormat={(value) => date.format(Number(value))}
            labelOverlap="skip"
            style={{ font: "10px sans-serif", fill: "#91a2ba" }}
          />
        </Group>
      </TradingTimeScale>
      <Text
        pointerEvents="none"
        style={{
          left: 16,
          top: height - 14,
          font: "9px sans-serif",
          fill: "#91a2ba",
        }}
      >
        {width < 440
          ? "Tap either pane · ← → inspect"
          : "Move or tap either pane · one recorded timestamp spans both axes"}
      </Text>
    </>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Lesson />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
