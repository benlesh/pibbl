import {
  FocusManagement,
  Path,
  Rectangle,
  Text,
  pibbl,
  useLayoutBox,
  useSignal,
  type PibblController,
  type PibblLogicalMouseEvent,
} from "@pibbl/core";
import { CandlestickSeries, LinearScale, UTCScale } from "@pibbl/core/viz";
import {
  nearestRecordedCandleX,
  paintedCandleAt,
  useCandleInspection,
  withInspection,
} from "@pibbl/core/viz/inspection";

const day = 86_400_000,
  start = Date.UTC(2026, 0, 5);
const bars = Array.from({ length: 48 }, (_, index) => {
  const open = 102 + Math.sin(index * 0.47) * 2.5 + index * 0.07;
  const close =
    index === 7 || index === 32 ? open : open + Math.sin(index * 1.31) * 1.7;
  return {
    time: start + index * day,
    open: +open.toFixed(2),
    high: +(Math.max(open, close) + 1.1 + (index % 3) * 0.35).toFixed(2),
    low: +(Math.min(open, close) - 0.9 - (index % 4) * 0.2).toFixed(2),
    close: +close.toFixed(2),
  };
});
// Each lesson owns its palette and signal; there is no global theme subscription.
const darkPalette = {
  background: "#0d1422",
  plot: "#101a2b",
  text: "#dbe6f1",
  muted: "#91a2ba",
  border: "#2a3950",
  grid: "#202d42",
  up: "#29c7ab",
  down: "#ed6975",
};
const lightPalette = {
  background: "#f6f8fb",
  plot: "#ffffff",
  text: "#18283d",
  muted: "#586b82",
  border: "#d3deeb",
  grid: "#e6edf5",
  up: "#00876e",
  down: "#cb4057",
};
function Chart() {
  const light = useSignal(false);
  const colors = light.get() ? lightPalette : darkPalette;
  const { width, height } = useLayoutBox();
  const ref = useCandleInspection({
    data: bars,
    time: "time",
    open: "open",
    high: "high",
    low: "low",
    close: "close",
  });
  const selected = useSignal(0),
    hover = useSignal<number | undefined>(undefined),
    part = useSignal<"body" | "wick" | undefined>(undefined);
  const active = hover.get() ?? selected.get();
  const row = bars[active]!;
  const left = 16,
    right = width - 52,
    top = 64,
    bottom = height - 44,
    candleWidth = Math.min(
      12,
      Math.max(2, ((right - left) * 0.7) / (bars.length - 1)),
    ),
    priceMin = 96,
    priceMax = 112;
  const grid = new Path2D();
  for (let index = 0; index < 5; index++) {
    const y = top + ((bottom - top) * index) / 4;
    grid.moveTo(left, y);
    grid.lineTo(right, y);
  }
  const hoverAt = withInspection((event: PibblLogicalMouseEvent, context) => {
    const rendered = context.rendered(ref);
    const time = rendered?.timeAtRoot({ x: event.x, y: event.y });
    if (!rendered || time === undefined) return;
    const hit = context.request(nearestRecordedCandleX, rendered, { time });
    if (hit) hover.set(hit.sourceIndex);
  });
  const choose = withInspection((event: PibblLogicalMouseEvent, context) => {
    const rendered = context.rendered(ref);
    const time = rendered?.timeAtRoot({ x: event.x, y: event.y });
    if (!rendered || time === undefined) return;
    const nearest = context.request(nearestRecordedCandleX, rendered, { time });
    if (nearest) {
      selected.set(nearest.sourceIndex);
      hover.set(undefined);
    }
    const painted = context.request(paintedCandleAt, rendered, {
      rootPoint: { x: event.x, y: event.y },
    });
    part.set(painted?.part);
  });
  const step = (direction: number) => {
    hover.set(undefined);
    selected.update((index) =>
      Math.max(0, Math.min(bars.length - 1, index + direction)),
    );
  };
  return (
    <>
      <Rectangle style={{ width, height, fill: colors.background }} />
      <Text
        pointerEvents="none"
        style={{
          left: 16,
          top: 14,
          font: "bold 13px sans-serif",
          fill: colors.text,
        }}
      >
        Northstar Systems · OHLC
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 16,
          top: 32,
          font: "10px sans-serif",
          fill: colors.muted,
        }}
      >
        Daily candles · deterministic simulation
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 16,
          top: 46,
          font: "10px ui-monospace, monospace",
          fill: colors.text,
        }}
      >{`O ${row.open.toFixed(2)} H ${row.high.toFixed(2)} L ${row.low.toFixed(2)} C ${row.close.toFixed(2)}`}</Text>
      <Rectangle
        style={{
          left,
          top,
          width: right - left,
          height: bottom - top,
          fill: colors.plot,
          stroke: colors.border,
          strokeWidth: 1,
        }}
      />
      <Path
        pointerEvents="none"
        style={{ d: grid, stroke: colors.grid, strokeWidth: 1 }}
      />
      <UTCScale
        id="time"
        domain={[bars[0]!.time - day / 2, bars.at(-1)!.time + day / 2]}
        range={[left, right]}
      >
        <LinearScale
          id="price"
          domain={[priceMin, priceMax]}
          range={[bottom, top]}
        >
          <CandlestickSeries
            data={bars}
            time="time"
            open="open"
            high="high"
            low="low"
            close="close"
            xScale="time"
            yScale="price"
            inspection={ref}
            pointerEvents="none"
            style={(datum, index) => ({
              bandwidth: candleWidth,
              opacity: active === index ? 1 : 0.68,
              body: {
                fill: datum.close >= datum.open ? colors.up : colors.down,
                stroke: datum.close >= datum.open ? colors.up : colors.down,
                strokeWidth: 1,
              },
              wick: { stroke: colors.muted, strokeWidth: 1 },
            })}
          />
        </LinearScale>
      </UTCScale>
      <Rectangle
        keyboardFocusable
        onPointerMove={hoverAt}
        onPointerLeave={() => hover.set(undefined)}
        onClick={choose}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          }
        }}
        style={{
          left,
          top,
          width: right - left,
          height: bottom - top,
          fill: "rgba(0,0,0,0)",
        }}
      />
      {Array.from(
        { length: 5 },
        (_, index) => priceMax - ((priceMax - priceMin) * index) / 4,
      ).map((value, index) => (
        <Text
          pointerEvents="none"
          style={{
            left: right + 8,
            top: top - 5 + ((bottom - top) * index) / 4,
            font: "10px ui-monospace, monospace",
            fill: colors.muted,
          }}
        >
          {value.toFixed(2)}
        </Text>
      ))}
      {[0, 16, 32, 47].map((index) => (
        <Text
          pointerEvents="none"
          style={{
            left: left + ((right - left) * (index + 0.5)) / bars.length - 10,
            top: bottom + 9,
            font: "10px ui-monospace, monospace",
            fill: colors.muted,
          }}
        >
          {new Date(bars[index]!.time).toISOString().slice(5, 10)}
        </Text>
      ))}
      <Text
        pointerEvents="none"
        style={{
          left: 16,
          top: height - 12,
          font: "9px sans-serif",
          fill: colors.muted,
        }}
      >{`${new Date(row.time).toISOString().slice(5, 10)} · Move · click body/wick · arrows${part.get() ? ` · ${part.get()}` : ""}`}</Text>
      <Rectangle
        keyboardFocusable
        onClick={() => light.update((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            light.update((value) => !value);
          }
        }}
        style={{
          left: width - 76,
          top: 10,
          width: 60,
          height: 24,
          fill: colors.plot,
          stroke: colors.muted,
          strokeWidth: 0.5,
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: width - 46,
          top: 17,
          font: "10px sans-serif",
          fill: colors.text,
          textAlign: "center",
        }}
      >
        {light.get() ? "Light" : "Dark"}
      </Text>
    </>
  );
}
/** Mount the responsive candle lesson. */
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Chart />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
