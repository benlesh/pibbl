import {
  FocusManagement,
  Group,
  Overlay,
  Rectangle,
  Circle,
  Text,
  pibbl,
  useLayoutBox,
  useSignal,
  type PibblController,
  type PibblPointerEvent,
} from "@pibbl/core";
import {
  IntervalBandSeries,
  Axis,
  GridLines,
  LineSeries,
  UTCScale,
  LinearScale,
  useUTCScale,
  useLinearScale,
} from "@pibbl/core/viz";

// NOAA/NCEI GHCN-Daily, station USW00094728 (Central Park), Jan 1–12 2020.
// Daily observed TMIN/TMAX in °C, not uncertainty. DOI: 10.7289/V5D21VHZ.
// Retrieved 2026-10-06; metric API values retained with no unit conversion.
// https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=USW00094728&startDate=2020-01-01&endDate=2020-01-12&format=json&includeAttributes=true&units=metric
// All TMIN/TMAX attributes are ",,W": no measurement/quality flags; WBAN source.
// NOAA/NCEI federal environmental data are public domain in the US; credit NOAA.
// Omit Jan 6 is an explicit demonstration filter, not a missing source record.
const data = [
  [1.1, 5.0],
  [0.6, 9.4],
  [6.7, 9.4],
  [5.0, 10.6],
  [1.7, 5.6],
  [0, 7.2],
  [2.2, 7.2],
  [-2.1, 5.6],
  [-4.9, 1.1],
  [0.6, 12.8],
  [10.6, 20.6],
  [6.1, 20.0],
].map(([lower, upper], i) => ({
  time: Date.UTC(2020, 0, i + 1),
  lower,
  upper,
}));
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const ink = "#172f3d",
  muted = "#526975",
  teal = "#087f8c";
function Label({
  x,
  y,
  text,
  size = 11,
}: {
  x: number;
  y: number;
  text: string;
  size?: number;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        font: `${size}px sans-serif`,
        fill: ink,
        textBaseline: "alphabetic",
      }}
    >
      {text}
    </Text>
  );
}
function Button({
  x,
  text,
  action,
}: {
  x: number;
  text: string;
  action: () => void;
}) {
  return (
    <Group style={{ translateX: x, translateY: 35 }}>
      <Rectangle
        keyboardFocusable
        onClick={action}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            action();
          }
        }}
        style={{
          width: 134,
          height: 44,
          fill: "#ffffff",
          stroke: "#b7cdd0",
          strokeWidth: 1,
          cornerRadius: 5,
          cursor: "pointer",
        }}
      />
      <Label x={9} y={27} text={text} />
    </Group>
  );
}
function Plot({
  outline,
  gap,
  left,
}: {
  outline: boolean;
  gap: boolean;
  left: number;
}) {
  const { width, height } = useLayoutBox(),
    x = useUTCScale("date").get(),
    y = useLinearScale("temperature").get();
  const selected = useSignal(0),
    focused = useSignal(false);
  const row = data[selected.get()],
    px = x.map(row.time),
    lo = y.map(row.lower),
    hi = y.map(row.upper);
  const inspect = (e: PibblPointerEvent) => {
    const value = x.invert(e.x - left);
    let best = 0;
    for (let i = 1; i < data.length; i++)
      if (Math.abs(data[i].time - value) < Math.abs(data[best].time - value))
        best = i;
    selected.set(best);
  };
  const defined = (d: typeof row) => !gap || d.time !== data[5].time;
  return (
    <>
      <GridLines
        scale="temperature"
        direction="horizontal"
        span={[0, width]}
        tickValues={[-10, 0, 10, 20]}
      />
      <IntervalBandSeries
        data={data}
        x="time"
        lower="lower"
        upper="upper"
        defined={defined}
        xScale="date"
        yScale="temperature"
        pointerEvents="none"
        style={{ fill: teal, opacity: 0.22 }}
      />
      {outline && (
        <>
          <LineSeries
            data={data}
            x="time"
            y="lower"
            defined={defined}
            xScale="date"
            yScale="temperature"
            pointerEvents="none"
            style={{ stroke: teal }}
          />
          <LineSeries
            data={data}
            x="time"
            y="upper"
            defined={defined}
            xScale="date"
            yScale="temperature"
            pointerEvents="none"
            style={{ stroke: teal }}
          />
        </>
      )}
      <Axis
        scale="temperature"
        position="left"
        tickValues={[-10, 0, 10, 20]}
        labelOverlap="skip"
        style={{ font: "10px sans-serif", fill: muted }}
      />
      <Axis
        scale="date"
        position="bottom"
        tickValues={[data[0].time, data[5].time, data[11].time]}
        tickFormat={(v) => date.format(Number(v))}
        style={{ font: "10px sans-serif", fill: muted }}
      />
      <Label
        x={0}
        y={-10}
        text={`${date.format(row.time)} · ${row.lower.toFixed(1)}–${row.upper.toFixed(1)} °C${gap && selected.get() === 5 ? " · omitted" : ""}`}
      />
      {defined(row) && (
        <>
          <Circle
            pointerEvents="none"
            style={{ cx: px, cy: lo, radius: 3, fill: ink }}
          />
          <Circle
            pointerEvents="none"
            style={{ cx: px, cy: hi, radius: 3, fill: ink }}
          />
        </>
      )}
      <Rectangle
        keyboardFocusable
        onFocus={() => focused.set(true)}
        onBlur={() => focused.set(false)}
        onPointerMove={inspect}
        onPointerDown={inspect}
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            selected.set(
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? 11
                  : Math.max(
                      0,
                      Math.min(
                        11,
                        selected.get() + (e.key === "ArrowLeft" ? -1 : 1),
                      ),
                    ),
            );
          }
        }}
        style={{
          width,
          height,
          fill: "transparent",
          stroke: focused.get() ? ink : undefined,
          strokeWidth: 1,
          cursor: "crosshair",
        }}
      />
    </>
  );
}
function Scene() {
  const { width, height } = useLayoutBox(),
    outline = useSignal(true),
    gap = useSignal(false);
  const left = 42,
    top = height < 400 ? 99 : 136,
    plotHeight = Math.max(1, height - top - 69),
    plotWidth = Math.max(1, width - left - 22);
  return (
    <>
      <Rectangle style={{ width, height, fill: "#f7faf9" }} />
      <Text
        pointerEvents="none"
        style={{
          left: 14,
          top: 24,
          font: "600 22px sans-serif",
          fill: ink,
          textBaseline: "alphabetic",
          when: [
            {
              query: { maxWidth: 400 },
              style: { font: "600 18px sans-serif" },
            },
            {
              query: { maxHeight: 350 },
              style: { font: "600 18px sans-serif" },
            },
          ],
        }}
      >
        Twelve winter days
      </Text>
      <Button
        x={14}
        text={outline.get() ? "Hide boundaries" : "Show boundaries"}
        action={() => outline.update((v) => !v)}
      />
      <Button
        x={156}
        text={gap.get() ? "Restore Jan 6" : "Omit Jan 6 (demo)"}
        action={() => gap.update((v) => !v)}
      />
      <Group style={{ translateX: left, translateY: top }}>
        <Overlay style={{ width: plotWidth, height: plotHeight }}>
          <UTCScale
            id="date"
            domain={[data[0].time, data[11].time]}
            range="width"
            style={{ width: "100%", height: "100%" }}
          >
            <LinearScale
              id="temperature"
              domain={[-10, 25]}
              range="height"
              reverse
            >
              <Plot outline={outline.get()} gap={gap.get()} left={left} />
            </LinearScale>
          </UTCScale>
        </Overlay>
      </Group>
      <Label
        x={14}
        y={height - 35}
        text="Fill = observed daily min–max, not uncertainty."
        size={10}
      />
      <Label
        x={14}
        y={height - 21}
        text="NOAA / NCEI · Central Park · Jan 2020 · °C · UTC"
        size={10}
      />
      <Label
        x={14}
        y={height - 7}
        text="Hover / tap · Tab, ← →, Home / End to inspect"
        size={10}
      />
    </>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Scene />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
