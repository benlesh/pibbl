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
import { LinearScale, UTCScale, VolumeSeries } from "@pibbl/core/viz";
import {
  nearestRecordedVolumeX,
  useVolumeInspection,
  withInspection,
} from "@pibbl/core/viz/inspection";

const day = 86_400_000,
  start = Date.UTC(2026, 0, 5);
const bars = Array.from({ length: 24 }, (_, index) => ({
  time: start + index * day,
  volume: Math.round(
    62 +
      Math.abs(Math.sin(index * 0.55)) * 62 +
      (index === 6 || index === 17 ? 96 : 0) +
      (index % 5) * 9,
  ),
}));
// Each lesson owns its palette and signal; there is no global theme subscription.
const darkPalette = {
  background: "#0d1422",
  plot: "#101a2b",
  text: "#dbe6f1",
  muted: "#91a2ba",
  border: "#2a3950",
  grid: "#202d42",
  accent: "#738ef1",
};
const lightPalette = {
  background: "#f6f8fb",
  plot: "#ffffff",
  text: "#18283d",
  muted: "#586b82",
  border: "#d3deeb",
  grid: "#e6edf5",
  accent: "#4465cc",
};
function Chart() {
  const light = useSignal(false);
  const colors = light.get() ? lightPalette : darkPalette;
  const { width, height } = useLayoutBox();
  const ref = useVolumeInspection({
    data: bars,
    time: "time",
    volume: "volume",
  });
  const selected = useSignal(0),
    hover = useSignal<number | undefined>(undefined);
  const active = hover.get() ?? selected.get();
  const row = bars[active]!;
  const left = 16,
    right = width - 52,
    top = 64,
    bottom = height - 44,
    markWidth = Math.min(
      12,
      Math.max(2, ((right - left) * 0.7) / (bars.length - 1)),
    );
  const grid = new Path2D();
  for (let index = 0; index < 5; index++) {
    const y = top + ((bottom - top) * index) / 4;
    grid.moveTo(left, y);
    grid.lineTo(right, y);
  }
  const inspect = withInspection((event: PibblLogicalMouseEvent, context) => {
    const rendered = context.rendered(ref);
    const time = rendered?.timeAtRoot({ x: event.x, y: event.y });
    if (!rendered || time === undefined) return;
    const hit = context.request(nearestRecordedVolumeX, rendered, { time });
    if (hit) hover.set(hit.sourceIndex);
  });
  const choose = withInspection((event: PibblLogicalMouseEvent, context) => {
    const rendered = context.rendered(ref);
    const time = rendered?.timeAtRoot({ x: event.x, y: event.y });
    if (!rendered || time === undefined) return;
    const hit = context.request(nearestRecordedVolumeX, rendered, { time });
    if (hit) {
      selected.set(hit.sourceIndex);
      hover.set(undefined);
    }
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
        Northstar Systems · Volume
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
        Daily shares · deterministic simulation
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 16,
          top: 46,
          font: "10px ui-monospace, monospace",
          fill: colors.text,
        }}
      >{`${new Date(row.time).toISOString().slice(5, 10)} · ${row.volume} shares`}</Text>
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
        <LinearScale id="volume" domain={[0, 240]} range={[bottom, top]}>
          <VolumeSeries
            data={bars}
            time="time"
            volume="volume"
            xScale="time"
            yScale="volume"
            inspection={ref}
            pointerEvents="none"
            style={(_, index) => ({
              width: markWidth,
              fill: colors.accent,
              opacity: active === index ? 1 : 0.62,
            })}
          />
        </LinearScale>
      </UTCScale>
      <Rectangle
        keyboardFocusable
        onPointerMove={inspect}
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
      {[240, 180, 120, 60, 0].map((value, index) => (
        <Text
          pointerEvents="none"
          style={{
            left: right + 8,
            top: top - 5 + ((bottom - top) * index) / 4,
            font: "10px ui-monospace, monospace",
            fill: colors.muted,
          }}
        >
          {String(value)}
        </Text>
      ))}
      {[0, 8, 16, 23].map((index) => (
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
      >
        Move · click · arrows
      </Text>
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
/** Mount the responsive volume lesson. */
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Chart />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
