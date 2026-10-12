import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useLayoutBox,
  useSignal,
  type PibblController,
} from "@pibbl/core";
import {
  Axis,
  GridLines,
  LinearScale,
  LineSeries,
  TradingTimeScale,
  formatNumber,
} from "@pibbl/core/viz";

// Studio lessons are self-contained; the same tested operations are deliberately local here.
function utcPeriodRange(
  timestamps: readonly number[],
  { startTime, endTime }: { startTime: number; endTime: number },
): readonly [number, number] | undefined {
  const first = timestamps.findIndex(
    (time) => time >= startTime && time <= endTime,
  );
  if (first < 0) return undefined;
  let last = first;
  for (let index = first + 1; index < timestamps.length; index += 1)
    if (timestamps[index]! >= startTime && timestamps[index]! <= endTime)
      last = index;
  return [first - 0.5, last + 0.5];
}
function calendarMonthsBefore(asOfTime: number, months: number): number {
  const source = new Date(asOfTime),
    targetMonth = source.getUTCMonth() - months;
  const year = source.getUTCFullYear() + Math.floor(targetMonth / 12),
    month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(
    year,
    month,
    Math.min(source.getUTCDate(), lastDay),
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  );
}
function bounded(
  range: readonly [number, number],
  bounds: readonly [number, number],
  minimumSpan: number,
): readonly [number, number] {
  const span = Math.min(
    bounds[1] - bounds[0],
    Math.max(minimumSpan, range[1] - range[0]),
  );
  const start = Math.max(bounds[0], Math.min(bounds[1] - span, range[0]));
  return [start, start + span];
}
function shiftLogicalRange(
  range: readonly [number, number],
  {
    delta,
    bounds,
    minimumSpan,
  }: { delta: number; bounds: readonly [number, number]; minimumSpan: number },
) {
  return bounded([range[0] + delta, range[1] + delta], bounds, minimumSpan);
}
function zoomLogicalRange(
  range: readonly [number, number],
  {
    factor,
    bounds,
    minimumSpan,
  }: { factor: number; bounds: readonly [number, number]; minimumSpan: number },
) {
  const midpoint = (range[0] + range[1]) / 2,
    span = Math.max(minimumSpan, (range[1] - range[0]) * factor);
  return bounded(
    [midpoint - span / 2, midpoint + span / 2],
    bounds,
    minimumSpan,
  );
}
function latestLogicalRange(
  range: readonly [number, number],
  {
    bounds,
    minimumSpan,
  }: { bounds: readonly [number, number]; minimumSpan: number },
) {
  const span = Math.max(minimumSpan, range[1] - range[0]);
  return bounded([bounds[1] - span, bounds[1]], bounds, minimumSpan);
}

/** Calendar-aligned ticks drawn only from supplied visible sessions. */
function calendarAxisTicks(
  timestamps: readonly number[],
  {
    logicalRange,
    width,
  }: { logicalRange: readonly [number, number]; width: number },
): { values: readonly number[]; format: (time: number) => string } {
  const visible = timestamps.slice(
    Math.max(0, Math.ceil(logicalRange[0])),
    Math.floor(logicalRange[1]) + 1,
  );
  const elapsedDays = visible.length
    ? (visible.at(-1)! - visible[0]!) / 86_400_000
    : 0;
  const monthly = elapsedDays > 60,
    weekly = elapsedDays > 10 && !monthly;
  const formatter = new Intl.DateTimeFormat(
    "en-GB",
    monthly
      ? { month: "short", year: "numeric", timeZone: "UTC" }
      : { day: "2-digit", month: "short", timeZone: "UTC" },
  );
  const candidates: number[] = [];
  let previousBucket: number | undefined;
  for (const time of visible) {
    const date = new Date(time);
    const bucket = monthly
      ? date.getUTCFullYear() * 12 + date.getUTCMonth()
      : weekly
        ? Math.floor(
            (time - ((date.getUTCDay() + 6) % 7) * 86_400_000) /
              (7 * 86_400_000),
          )
        : Math.floor(time / 86_400_000);
    if (bucket !== previousBucket) candidates.push(time);
    previousBucket = bucket;
  }
  const budget = Math.max(2, Math.floor(width / 80));
  const values =
    candidates.length <= budget
      ? candidates
      : Array.from(
          { length: budget },
          (_, i) =>
            candidates[
              Math.round((i * (candidates.length - 1)) / (budget - 1))
            ]!,
        );
  return { values, format: (time) => formatter.format(time) };
}

const observations = (() => {
  const rows: { time: number; close: number }[] = [];
  let time = Date.UTC(2025, 11, 31, 16),
    close = 98.4;
  while (time <= Date.UTC(2026, 2, 31, 16)) {
    const day = new Date(time).getUTCDay();
    if (day !== 0 && day !== 6) {
      const index = rows.length,
        shock =
          index === 32
            ? -3.1
            : index === 48
              ? 2.5
              : Math.sin(index * 1.37) * 0.85 + Math.cos(index * 0.63) * 0.46;
      close += shock;
      rows.push({ time, close });
    }
    time += 86_400_000;
  }
  return rows;
})();
const timestamps = observations.map((row) => row.time);
const asOfTime = timestamps.at(-1)!;
const bounds = [-0.5, timestamps.length - 0.5] as const;
const day = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
function Control({
  x,
  label,
  onActivate,
  active = false,
}: {
  x: number;
  label: string;
  onActivate: () => void;
  active?: boolean;
}) {
  return (
    <>
      <Rectangle
        keyboardFocusable
        onClick={onActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate();
          }
        }}
        style={{
          left: x,
          top: 55,
          width: 38,
          height: 21,
          fill: active ? "#135d59" : "#182840",
          stroke: active ? "#29c7ab" : "#506686",
          strokeWidth: 0.5,
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: x + 19,
          top: 61,
          font: "9px sans-serif",
          textAlign: "center",
          fill: "#dbe6f1",
        }}
      >
        {label}
      </Text>
    </>
  );
}
function Lesson() {
  const { width, height } = useLayoutBox();
  const viewport = useSignal<readonly [number, number]>(bounds);
  const range = viewport.get();
  const left = 54,
    right = width - 18,
    top = 89,
    bottom = height - 43;
  const presets = [
    {
      label: "1M",
      range: utcPeriodRange(timestamps, {
        startTime: calendarMonthsBefore(asOfTime, 1),
        endTime: asOfTime,
      }),
    },
    {
      label: "3M",
      range: utcPeriodRange(timestamps, {
        startTime: calendarMonthsBefore(asOfTime, 3),
        endTime: asOfTime,
      }),
    },
    {
      label: "YTD",
      range: utcPeriodRange(timestamps, {
        startTime: Date.UTC(new Date(asOfTime).getUTCFullYear(), 0, 1),
        endTime: asOfTime,
      }),
    },
    { label: "All", range: bounds },
  ];
  const matches = (candidate: readonly [number, number] | undefined) =>
    !!candidate &&
    Math.abs(candidate[0] - range[0]) < 1e-7 &&
    Math.abs(candidate[1] - range[1]) < 1e-7;
  const activeLabels = presets
    .filter((preset) => matches(preset.range))
    .map((preset) => preset.label);
  const dateTicks = calendarAxisTicks(timestamps, {
    logicalRange: range,
    width: right - left,
  });
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
        Northstar Materials · calendar windows
      </Text>
      <Text
        pointerEvents="none"
        style={{ left, top: 34, font: "9px sans-serif", fill: "#91a2ba" }}
      >{`As of ${day.format(asOfTime)} · 1M starts 28 Feb UTC; only supplied records`}</Text>
      {presets.map((preset, index) => (
        <Control
          x={8 + index * 44}
          label={preset.label}
          active={matches(preset.range)}
          onActivate={() => {
            if (preset.range) viewport.set(preset.range);
          }}
        />
      ))}
      <Control
        x={184}
        label="←"
        onActivate={() =>
          viewport.set(
            shiftLogicalRange(range, { delta: -2, bounds, minimumSpan: 2 }),
          )
        }
      />
      <Control
        x={228}
        label="→"
        onActivate={() =>
          viewport.set(
            shiftLogicalRange(range, { delta: 2, bounds, minimumSpan: 2 }),
          )
        }
      />
      <Control
        x={272}
        label="+"
        onActivate={() =>
          viewport.set(
            zoomLogicalRange(range, { factor: 0.65, bounds, minimumSpan: 2 }),
          )
        }
      />
      <Control
        x={316}
        label="Last"
        onActivate={() =>
          viewport.set(latestLogicalRange(range, { bounds, minimumSpan: 2 }))
        }
      />
      <TradingTimeScale
        id="time"
        timestamps={timestamps}
        logicalRange={range}
        range={[left, right]}
      >
        <LinearScale id="price" domain={[92, 108]} range={[bottom, top]}>
          <Rectangle
            pointerEvents="none"
            style={{
              left,
              top,
              width: right - left,
              height: bottom - top,
              fill: "#101a2b",
            }}
          />
          <GridLines
            scale="price"
            direction="horizontal"
            span={[left, right]}
            tickValues={[94, 100, 106]}
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
              tickValues={[94, 100, 106]}
              tickFormat={(value) =>
                `$${formatNumber(Number(value), { maximumFractionDigits: 0 })}`
              }
              style={{ font: "10px sans-serif", fill: "#91a2ba" }}
            />
          </Group>
          <LineSeries
            data={observations.filter(
              (_, index) =>
                index >= Math.ceil(range[0]) && index <= Math.floor(range[1]),
            )}
            x="time"
            y="close"
            xScale="time"
            yScale="price"
            pointerEvents="none"
            style={{ stroke: "#29c7ab", strokeWidth: 2 }}
          />
          <Group style={{ translateY: bottom - height }}>
            <Axis
              scale="time"
              position="bottom"
              tickValues={dateTicks.values}
              tickFormat={(value) => dateTicks.format(Number(value))}
              labelOverlap="skip"
              style={{ font: "10px sans-serif", fill: "#91a2ba" }}
            />
          </Group>
        </LinearScale>
      </TradingTimeScale>
      <Text
        pointerEvents="none"
        style={{
          left: 16,
          top: height - 14,
          font: "9px sans-serif",
          fill: "#91a2ba",
        }}
      >{`Range: ${activeLabels.join(" / ") || "Custom"} · ${observations.filter((_, i) => i >= range[0] && i <= range[1]).length} supplied sessions · simulated USD`}</Text>
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
