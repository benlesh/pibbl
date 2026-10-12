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
  AreaSeries,
  Axis,
  GridLines,
  LineSeries,
  ReferenceLine,
  UTCScale,
  LinearScale,
  useUTCScale,
  useLinearScale,
} from "@pibbl/core/viz";

// NOAA GML / Scripps monthly Mauna Loa CO2 means, ppm, Jan–Dec 1980.
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
// Unrounded values reused from the repository's 2026-09-28 snapshot.
// The optional June omission is a demonstration filter, not a missing NOAA record.
const data = [
  337.9, 338.34, 340.07, 340.93, 341.45, 341.36, 339.45, 337.67, 336.25, 336.14,
  337.3, 338.29,
].map((ppm, i) => ({ time: Date.UTC(1980, i, 1), ppm }));
const month = new Intl.DateTimeFormat("en-US", {
  month: "short",
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
  baseline,
  gap,
  left,
}: {
  baseline: number;
  gap: boolean;
  left: number;
}) {
  const { width, height } = useLayoutBox(),
    x = useUTCScale("date").get(),
    y = useLinearScale("ppm").get();
  const selected = useSignal(0),
    focused = useSignal(false);
  const row = data[selected.get()],
    px = x.map(row.time),
    py = y.map(row.ppm);
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
        scale="ppm"
        direction="horizontal"
        span={[0, width]}
        tickValues={[330, 335, 340, 345]}
      />
      <AreaSeries
        data={data}
        x="time"
        y="ppm"
        defined={defined}
        baseline={baseline}
        xScale="date"
        yScale="ppm"
        pointerEvents="none"
        style={{ fill: teal, opacity: 0.22 }}
      />
      <LineSeries
        data={data}
        x="time"
        y="ppm"
        defined={defined}
        xScale="date"
        yScale="ppm"
        pointerEvents="none"
        style={{ stroke: teal }}
      />
      <ReferenceLine
        scale="ppm"
        direction="horizontal"
        value={baseline}
        span={[0, width]}
        style={{ stroke: muted }}
      />
      <Axis
        scale="ppm"
        position="left"
        tickValues={[330, 335, 340, 345]}
        labelOverlap="skip"
        style={{ font: "10px sans-serif", fill: muted }}
      />
      <Axis
        scale="date"
        position="bottom"
        tickValues={[data[0].time, data[5].time, data[11].time]}
        tickFormat={(v) => month.format(Number(v))}
        style={{ font: "10px sans-serif", fill: muted }}
      />
      <Label
        x={0}
        y={-10}
        text={`${month.format(row.time)} 1980 · ${row.ppm.toFixed(2)} ppm${gap && selected.get() === 5 ? " · omitted" : ""}`}
      />
      {defined(row) && (
        <Circle
          pointerEvents="none"
          style={{
            cx: px,
            cy: py,
            radius: 4,
            fill: ink,
            stroke: "white",
            strokeWidth: 1,
          }}
        />
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
    baseline = useSignal(330),
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
        CO₂ above a reference
      </Text>
      <Button
        x={14}
        text={`Baseline: ${baseline.get()} ppm`}
        action={() => baseline.set(baseline.get() === 330 ? 335 : 330)}
      />
      <Button
        x={156}
        text={gap.get() ? "Restore June" : "Omit June (demo)"}
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
            <LinearScale id="ppm" domain={[330, 345]} range="height" reverse>
              <Plot baseline={baseline.get()} gap={gap.get()} left={left} />
            </LinearScale>
          </UTCScale>
        </Overlay>
      </Group>
      <Label
        x={14}
        y={height - 35}
        text="Fill = distance above reference, not emissions."
        size={10}
      />
      <Label
        x={14}
        y={height - 21}
        text="NOAA / Scripps · Mauna Loa · 1980 · ppm · UTC"
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
