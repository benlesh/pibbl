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
  Axis,
  GridLines,
  LineSeries,
  PointSeries,
  PointScale,
  LinearScale,
  usePointScale,
  useLinearScale,
} from "@pibbl/core/viz";

// NOAA GML / Scripps monthly Mauna Loa CO2 means, ppm, Jan–Jun 1980.
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
// Unrounded values reused from the repository's 2026-09-28 snapshot.
// The optional March omission is a demonstration filter, not a missing NOAA record.
const data = [337.9, 338.34, 340.07, 340.93, 341.45, 341.36].map((ppm, i) => ({
  label: `${["January", "February", "March", "April", "May", "June"][i]} 1980 · Mauna Loa`,
  short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"][i],
  ppm,
}));
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
function Plot({ gap, left }: { gap: boolean; left: number }) {
  const { width, height } = useLayoutBox(),
    x = usePointScale("month").get(),
    y = useLinearScale("ppm").get();
  const selected = useSignal(0),
    focused = useSignal(false);
  const row = data[selected.get()],
    px = x.map(row.label)!,
    py = y.map(row.ppm);
  const inspect = (e: PibblPointerEvent) => {
    const value = x.invert(e.x - left);
    const index = data.findIndex((d) => d.label === value);
    if (index >= 0) selected.set(index);
  };
  const defined = (d: typeof row) => !gap || d.label !== data[2].label;
  return (
    <>
      <GridLines
        scale="ppm"
        direction="horizontal"
        span={[0, width]}
        tickValues={[330, 335, 340, 345]}
      />
      <LineSeries
        data={data}
        x="label"
        y="ppm"
        defined={defined}
        xScale="month"
        yScale="ppm"
        pointerEvents="none"
        style={{ stroke: teal }}
      />
      <PointSeries
        data={data}
        x="label"
        y="ppm"
        defined={defined}
        xScale="month"
        yScale="ppm"
        pointerEvents="none"
        style={{ radius: 3, fill: teal }}
      />
      <Axis
        scale="ppm"
        position="left"
        tickValues={[330, 335, 340, 345]}
        labelOverlap="skip"
        style={{ font: "10px sans-serif", fill: muted }}
      />
      <Axis
        scale="month"
        position="bottom"
        tickValues={data.map((d) => d.label)}
        tickFormat={(v) => data.find((d) => d.label === v)?.short ?? String(v)}
        labelOverlap="allow"
        style={{ font: "10px sans-serif", fill: muted }}
      />
      <Label
        x={-28}
        y={-10}
        size={10}
        text={`${row.label} · ${row.ppm.toFixed(2)} ppm${gap && selected.get() === 2 ? " · omitted" : ""}`}
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
                  ? 5
                  : Math.max(
                      0,
                      Math.min(
                        5,
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
    reverse = useSignal(false),
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
        Category identities
      </Text>
      <Button
        x={14}
        text={reverse.get() ? "Restore order" : "Reverse order"}
        action={() => reverse.update((v) => !v)}
      />
      <Button
        x={156}
        text={gap.get() ? "Restore March" : "Omit March (demo)"}
        action={() => gap.update((v) => !v)}
      />
      <Group style={{ translateX: left, translateY: top }}>
        <Overlay style={{ width: plotWidth, height: plotHeight }}>
          <PointScale
            id="month"
            domain={data.map((d) => d.label)}
            range="width"
            reverse={reverse.get()}
            padding={0.2}
            style={{ width: "100%", height: "100%" }}
          >
            <LinearScale id="ppm" domain={[330, 345]} range="height" reverse>
              <Plot gap={gap.get()} left={left} />
            </LinearScale>
          </PointScale>
        </Overlay>
      </Group>
      <Label
        x={14}
        y={height - 35}
        text="All six identities retained · selected full record."
        size={10}
      />
      <Label
        x={14}
        y={height - 21}
        text="NOAA / Scripps · Mauna Loa · Jan–Jun 1980 · ppm"
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
