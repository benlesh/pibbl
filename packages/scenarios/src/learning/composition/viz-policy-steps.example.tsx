import {
  FocusManagement,
  Group,
  Overlay,
  Rectangle,
  Text,
  Circle,
  pibbl,
  useLayoutBox,
  useSignal,
  type PibblController,
  type PibblPointerEvent,
} from "@pibbl/core";
import {
  Axis,
  GridLines,
  IntervalBandSeries,
  LineSeries,
  UTCScale,
  LinearScale,
  useUTCScale,
  useLinearScale,
  stepBefore,
  stepAfter,
  stepMidpoint,
  type SeriesCurve,
} from "@pibbl/core/viz";
// Federal Reserve Board: 2022 Record of Policy Actions, target ranges in percent.
// https://www.federalreserve.gov/publications/2022-ar-record-of-policy-actions-of-the-board-of-governors.htm
// Effective calendar dates, not intraday timestamps or observed market rates.
// Verified 2026-10-06. Values are held until the next effective date.
const data = [
  { time: Date.UTC(2022, 2, 17), lower: 0.25, upper: 0.5 },
  { time: Date.UTC(2022, 4, 5), lower: 0.75, upper: 1 },
  { time: Date.UTC(2022, 5, 16), lower: 1.5, upper: 1.75 },
  { time: Date.UTC(2022, 6, 28), lower: 2.25, upper: 2.5 },
  { time: Date.UTC(2022, 8, 22), lower: 3, upper: 3.25 },
  { time: Date.UTC(2022, 10, 3), lower: 3.75, upper: 4 },
  { time: Date.UTC(2022, 11, 15), lower: 4.25, upper: 4.5 },
];
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const definitions = [stepBefore(), stepMidpoint(), stepAfter()];
const names = ["Before", "Midpoint", "After"];
const ink = "#172f3d",
  teal = "#087f8c",
  muted = "#526975";
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
        textBaseline: "alphabetic",
        fill: ink,
      }}
    >
      {text}
    </Text>
  );
}
function Plot({ curve, left }: { curve: SeriesCurve; left: number }) {
  const { width, height } = useLayoutBox(),
    x = useUTCScale("date").get(),
    y = useLinearScale("rate").get(),
    selected = useSignal(0),
    focused = useSignal(false),
    row = data[selected.get()];
  const inspect = (e: PibblPointerEvent) => {
    const value = x.invert(e.x - left);
    let best = 0;
    for (let i = 1; i < data.length; i++)
      if (Math.abs(data[i].time - value) < Math.abs(data[best].time - value))
        best = i;
    selected.set(best);
  };
  return (
    <>
      <GridLines
        scale="rate"
        direction="horizontal"
        span={[0, width]}
        tickValues={[0, 1, 2, 3, 4, 5]}
      />
      <IntervalBandSeries
        data={data}
        x="time"
        lower="lower"
        upper="upper"
        xScale="date"
        yScale="rate"
        curve={curve}
        pointerEvents="none"
        style={{ fill: teal, opacity: 0.3 }}
      />
      <LineSeries
        data={data}
        x="time"
        y="upper"
        xScale="date"
        yScale="rate"
        curve={curve}
        pointerEvents="none"
        style={{ stroke: teal }}
      />
      <LineSeries
        data={data}
        x="time"
        y="lower"
        xScale="date"
        yScale="rate"
        curve={curve}
        pointerEvents="none"
        style={{ stroke: teal, strokeWidth: 1 }}
      />
      <Axis
        scale="rate"
        position="left"
        tickValues={[0, 1, 2, 3, 4, 5]}
        labelOverlap="skip"
        tickFormat={(v) => `${v}%`}
        style={{ font: "10px sans-serif", fill: muted }}
      />
      <Axis
        scale="date"
        position="bottom"
        tickValues={[data[0].time, data[3].time, data[6].time]}
        tickFormat={(v) => date.format(Number(v))}
        style={{ font: "10px sans-serif", fill: muted }}
      />
      <Label
        x={0}
        y={-10}
        text={`${date.format(row.time)} · ${row.lower.toFixed(2)}–${row.upper.toFixed(2)}%`}
      />
      <Circle
        pointerEvents="none"
        style={{
          cx: x.map(row.time),
          cy: y.map(row.upper),
          radius: 3,
          fill: ink,
        }}
      />
      <Rectangle
        keyboardFocusable
        onFocus={() => focused.set(true)}
        onBlur={() => focused.set(false)}
        onPointerDown={inspect}
        onPointerMove={inspect}
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            selected.set(
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? 6
                  : Math.max(
                      0,
                      Math.min(
                        6,
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
    selected = useSignal(2),
    left = 42,
    top = height < 400 ? 99 : 136,
    bw = Math.min(110, (width - 28) / 3);
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
        Policy changes in steps
      </Text>
      {names.map((name, i) => (
        <Group key={name} style={{ translateX: 14 + i * bw, translateY: 35 }}>
          <Rectangle
            keyboardFocusable
            onClick={() => selected.set(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selected.set(i);
              }
            }}
            style={{
              width: bw - 4,
              height: 44,
              fill: selected.get() === i ? ink : "white",
              stroke: "#b7cdd0",
              strokeWidth: 1,
              cornerRadius: 5,
              cursor: "pointer",
            }}
          />
          <Text
            pointerEvents="none"
            style={{
              left: (bw - 4) / 2,
              top: 22,
              font: "12px sans-serif",
              fill: selected.get() === i ? "white" : ink,
              textAlign: "center",
              textBaseline: "middle",
            }}
          >
            {name}
          </Text>
        </Group>
      ))}
      <Group style={{ translateX: left, translateY: top }}>
        <Overlay
          style={{
            width: Math.max(1, width - left - 24),
            height: Math.max(1, height - top - 69),
          }}
        >
          <UTCScale
            id="date"
            domain={[data[0].time, data[6].time]}
            range="width"
            style={{ width: "100%", height: "100%" }}
          >
            <LinearScale id="rate" domain={[0, 5]} range="height" reverse>
              <Plot curve={definitions[selected.get()]} left={left} />
            </LinearScale>
          </UTCScale>
        </Overlay>
      </Group>
      <Label
        x={14}
        y={height - 35}
        text={
          selected.get() === 2
            ? "After = policy held until next effective date."
            : `${names[selected.get()]} = geometry illustration, not policy.`
        }
        size={10}
      />
      <Label
        x={14}
        y={height - 21}
        text="Federal Reserve · 2022 target range · % · days"
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
