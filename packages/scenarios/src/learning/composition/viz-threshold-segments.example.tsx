import {
  Circle,
  FocusManagement,
  Group,
  Overlay,
  Rectangle,
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
  LinearScale,
  ReferenceLine,
  UTCScale,
  useLinearScale,
  useUTCScale,
} from "@pibbl/core/viz";

// NOAA GML / Scripps monthly Mauna Loa CO2 means, ppm, Jan–Dec 1980.
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
// Unrounded values reused from the repository's 2026-09-28 snapshot.
const data = [
  337.9, 338.34, 340.07, 340.93, 341.45, 341.36, 339.45, 337.67, 336.25, 336.14,
  337.3, 338.29,
].map((ppm, index) => ({ time: Date.UTC(1980, index, 1), ppm }));

type Observation = (typeof data)[number];
type ThresholdSegment = Readonly<{
  side: "above" | "below";
  points: readonly Observation[];
}>;

/** App-local recipe that preserves observations and adds only shared linear crossing endpoints. */
function splitAtThreshold(
  observations: readonly Observation[],
  threshold: number,
): readonly ThresholdSegment[] {
  if (!Number.isFinite(threshold))
    throw new RangeError("Threshold must be finite.");
  if (observations.length === 0) return [];
  const side = (point: Observation): ThresholdSegment["side"] =>
    point.ppm >= threshold ? "above" : "below";
  const segments: ThresholdSegment[] = [];
  let currentSide = side(observations[0]);
  let current: Observation[] = [observations[0]];
  const finish = () => {
    if (current.length >= 2)
      segments.push(
        Object.freeze({ side: currentSide, points: Object.freeze(current) }),
      );
  };
  for (let index = 1; index < observations.length; index++) {
    const previous = observations[index - 1];
    const next = observations[index];
    const nextSide = side(next);
    const previousOffset = previous.ppm - threshold;
    const nextOffset = next.ppm - threshold;
    if (previousOffset * nextOffset < 0) {
      const ratio = -previousOffset / (nextOffset - previousOffset);
      const crossing = Object.freeze({
        time: previous.time + (next.time - previous.time) * ratio,
        ppm: threshold,
      });
      current.push(crossing);
      finish();
      currentSide = nextSide;
      current = [crossing, next];
    } else if (nextSide !== currentSide) {
      finish();
      currentSide = nextSide;
      current = [previous, next];
    } else current.push(next);
  }
  finish();
  return Object.freeze(segments);
}

const month = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});
const ink = "#172f3d";
const muted = "#526975";
const above = "#b45309";
const below = "#087f8c";

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
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
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
  threshold,
  left,
  onSegments,
  records,
}: {
  threshold: number;
  left: number;
  onSegments?: (segments: readonly ThresholdSegment[]) => void;
  records: readonly Observation[];
}) {
  const { width, height } = useLayoutBox();
  const x = useUTCScale("date").get();
  const y = useLinearScale("ppm").get();
  const selected = useSignal(0);
  const focused = useSignal(false);
  const row = records[selected.get()];
  const px = x.map(row.time);
  const py = y.map(row.ppm);
  const segments = splitAtThreshold(records, threshold);
  onSegments?.(segments);
  const inspect = (event: PibblPointerEvent) => {
    const value = x.invert(event.x - left);
    let nearest = 0;
    for (let index = 1; index < records.length; index++)
      if (
        Math.abs(records[index].time - value) <
        Math.abs(records[nearest].time - value)
      )
        nearest = index;
    selected.set(nearest);
  };
  return (
    <>
      <GridLines
        scale="ppm"
        direction="horizontal"
        span={[0, width]}
        tickValues={[330, 335, 340, 345]}
      />
      {segments.map((segment, index) => (
        <LineSeries
          key={`${segment.side}-${index}`}
          data={segment.points}
          x="time"
          y="ppm"
          xScale="date"
          yScale="ppm"
          pointerEvents="none"
          style={{
            stroke: segment.side === "above" ? above : below,
            strokeWidth: 2.5,
          }}
        />
      ))}
      <ReferenceLine
        scale="ppm"
        direction="horizontal"
        value={threshold}
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
        tickValues={[
          records[0].time,
          records[Math.floor((records.length - 1) / 2)].time,
          records.at(-1)!.time,
        ]}
        tickFormat={(value) => month.format(Number(value))}
        style={{ font: "10px sans-serif", fill: muted }}
      />
      <Label
        x={0}
        y={-10}
        text={`${month.format(row.time)} 1980 · ${row.ppm.toFixed(2)} ppm`}
      />
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
      <Rectangle
        keyboardFocusable
        onFocus={() => focused.set(true)}
        onBlur={() => focused.set(false)}
        onPointerMove={inspect}
        onPointerDown={inspect}
        onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            selected.set(
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? records.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        records.length - 1,
                        selected.get() + (event.key === "ArrowLeft" ? -1 : 1),
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

function Scene({
  onSegments,
  records,
  initialThreshold,
}: {
  onSegments?: (segments: readonly ThresholdSegment[]) => void;
  records: readonly Observation[];
  initialThreshold: number;
}) {
  const { width, height } = useLayoutBox();
  const threshold = useSignal(initialThreshold);
  const left = 42;
  const top = height < 400 ? 99 : 136;
  const plotHeight = Math.max(1, height - top - 69);
  const plotWidth = Math.max(1, width - left - 22);
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
        Threshold-colored CO₂
      </Text>
      <Button
        x={14}
        text={`Threshold: ${threshold.get()} ppm`}
        action={() => threshold.set(338)}
      />
      <Button x={156} text="Use 340 ppm" action={() => threshold.set(340)} />
      <Group style={{ translateX: left, translateY: top }}>
        <Overlay style={{ width: plotWidth, height: plotHeight }}>
          <UTCScale
            id="date"
            domain={[records[0].time, records.at(-1)!.time]}
            range="width"
            style={{ width: "100%", height: "100%" }}
          >
            <LinearScale id="ppm" domain={[330, 345]} range="height" reverse>
              <Plot
                threshold={threshold.get()}
                left={left}
                onSegments={onSegments}
                records={records}
              />
            </LinearScale>
          </UTCScale>
        </Overlay>
      </Group>
      <Label
        x={14}
        y={height - 35}
        text="Crossings are linearly interpolated at the selected threshold."
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

type Config = {
  readonly onSegments?: (segments: readonly ThresholdSegment[]) => void;
  readonly data?: readonly Observation[];
  readonly threshold?: number;
};

export default function mount(
  canvas: HTMLCanvasElement,
  config: Config = {},
): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Scene
        onSegments={config.onSegments}
        records={config.data ?? data}
        initialThreshold={config.threshold ?? 338}
      />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
