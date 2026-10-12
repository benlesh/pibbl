import {
  Circle,
  FocusManagement,
  Group,
  Overlay,
  Rectangle,
  Text,
  pibbl,
  resolveSignalValue,
  useConst,
  useLayoutBox,
  useReaction,
  useSignal,
  type PibblController,
  type PibblPointerEvent,
  type SignalValue,
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
const defaultData = [
  337.9, 338.34, 340.07, 340.93, 341.45, 341.36, 339.45, 337.67, 336.25, 336.14,
  337.3, 338.29,
].map((ppm, index) => ({ time: Date.UTC(1980, index, 1), ppm }));
type Datum = { time: number; ppm: number };
type Config = { readonly data?: SignalValue<readonly Datum[]> };
const month = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});
const ink = "#172f3d",
  muted = "#526975",
  teal = "#087f8c";
const formatAnomaly = (ppm: number) =>
  `${ppm >= 0 ? "+" : ""}${ppm.toFixed(2)} ppm vs 330`;
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

function PlotBody({
  anomaly,
  dateScale,
  valueScale,
  records,
  selected,
  width,
  height,
  originX,
  onChoose,
  onLeave,
  onKeyDown,
  focused,
  onFocus,
  onBlur,
}: {
  anomaly: boolean;
  dateScale: string;
  valueScale: string;
  records: readonly Datum[];
  selected: Datum | undefined;
  width: number;
  height: number;
  originX: number;
  onChoose: (key: number, commit: boolean) => void;
  onLeave: () => void;
  onKeyDown: (event: { key: string; preventDefault(): void }) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const x = useUTCScale(dateScale).get();
  const y = useLinearScale(valueScale).get();
  const choose = (event: PibblPointerEvent) => {
    const time = x.invert(event.x - originX);
    let nearest = records[0];
    for (let index = 1; index < records.length; index++)
      if (Math.abs(records[index].time - time) < Math.abs(nearest.time - time))
        nearest = records[index];
    onChoose(nearest.time, false);
  };
  const value = (row: Datum) => (anomaly ? row.ppm - 330 : row.ppm);
  const ticks = anomaly ? [0, 10] : [330, 340];
  return (
    <>
      <GridLines
        scale={valueScale}
        direction="horizontal"
        span={[0, width]}
        tickValues={ticks}
      />
      <LineSeries
        data={records}
        x="time"
        y={value}
        xScale={dateScale}
        yScale={valueScale}
        pointerEvents="none"
        style={{ stroke: teal, strokeWidth: 2.5 }}
      />
      <Axis
        scale={valueScale}
        position="left"
        tickValues={ticks}
        labelOverlap="skip"
        style={{ font: "10px sans-serif", fill: muted }}
      />
      <Axis
        scale={dateScale}
        position="bottom"
        tickValues={
          records[0].time === records.at(-1)!.time
            ? [records[0].time]
            : [records[0].time, records.at(-1)!.time]
        }
        tickFormat={(item) => month.format(Number(item))}
        style={{ font: "10px sans-serif", fill: muted }}
      />
      {selected && (
        <>
          <ReferenceLine
            scale={dateScale}
            direction="vertical"
            value={selected.time}
            span={[0, height]}
            style={{ stroke: muted }}
          />
          <ReferenceLine
            scale={valueScale}
            direction="horizontal"
            value={value(selected)}
            span={[0, width]}
            style={{ stroke: muted }}
          />
          <Circle
            pointerEvents="none"
            style={{
              cx: x.map(selected.time),
              cy: y.map(value(selected)),
              radius: 4,
              fill: ink,
              stroke: "white",
              strokeWidth: 1,
            }}
          />
        </>
      )}
      <Rectangle
        keyboardFocusable
        onFocus={onFocus}
        onBlur={onBlur}
        onPointerMove={choose}
        onPointerDown={(event) => {
          const time = x.invert(event.x - originX);
          let nearest = records[0];
          for (let index = 1; index < records.length; index++)
            if (
              Math.abs(records[index].time - time) <
              Math.abs(nearest.time - time)
            )
              nearest = records[index];
          onChoose(nearest.time, true);
        }}
        onPointerLeave={onLeave}
        onKeyDown={onKeyDown}
        style={{
          width,
          height,
          fill: "transparent",
          stroke: focused ? ink : undefined,
          strokeWidth: 1,
          cursor: "crosshair",
        }}
      />
    </>
  );
}

function Panel({
  anomaly,
  records,
  selected,
  x,
  y,
  width,
  height,
  onChoose,
  onLeave,
  onKeyDown,
  focused,
  onFocus,
  onBlur,
}: {
  anomaly: boolean;
  records: readonly Datum[];
  selected: Datum | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
  onChoose: (key: number, commit: boolean) => void;
  onLeave: () => void;
  onKeyDown: (event: { key: string; preventDefault(): void }) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const firstTime = records[0].time;
  const lastTime = records.at(-1)!.time;
  const scaleLastTime =
    lastTime === firstTime ? firstTime + 86_400_000 : lastTime;
  const suffix = anomaly ? "anomaly" : "observed";
  return (
    <Group style={{ translateX: x, translateY: y }}>
      <Overlay style={{ width, height }}>
        <UTCScale
          id={`date-${suffix}`}
          domain={[firstTime, scaleLastTime]}
          range="width"
          style={{ width: "100%", height: "100%" }}
        >
          <LinearScale
            id={`value-${suffix}`}
            domain={anomaly ? [-2, 15] : [330, 345]}
            range="height"
            reverse
          >
            <PlotBody
              anomaly={anomaly}
              dateScale={`date-${suffix}`}
              valueScale={`value-${suffix}`}
              records={records}
              selected={selected}
              width={width}
              height={height}
              originX={x}
              onChoose={onChoose}
              onLeave={onLeave}
              onKeyDown={onKeyDown}
              focused={focused}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </LinearScale>
        </UTCScale>
      </Overlay>
    </Group>
  );
}

function Scene({ input }: { input: SignalValue<readonly Datum[]> }) {
  const { width, height } = useLayoutBox(),
    records = resolveSignalValue(input);
  if (!Array.isArray(records) || records.length === 0)
    throw new RangeError("Linked inspection requires observed records.");
  const committed = useSignal<number | null>(null),
    hovered = useSignal<number | null>(null),
    pinned = useSignal<number | null>(null),
    focused = useSignal(false);
  const retired = useConst(() => new Set<number>());
  useReaction(() => {
    const current = resolveSignalValue(input);
    const currentKeys = new Set(current.map((row) => row.time));
    for (const key of [committed.get(), hovered.get(), pinned.get()])
      if (key !== null && !currentKeys.has(key)) retired.add(key);
  }, [input]);
  const byKey = new Map(records.map((row) => [row.time, row]));
  const valid = (value: number | null) => {
    return value !== null && !retired.has(value) && byKey.has(value)
      ? value
      : null;
  };
  const pinnedKey = valid(pinned.get()),
    committedKey = valid(committed.get()),
    hoverKey = valid(hovered.get()),
    key = pinnedKey ?? committedKey ?? hoverKey,
    row = key === null ? undefined : byKey.get(key);
  const compact = width < 700,
    left = 42,
    top = height < 400 ? 95 : 136,
    bottom = 69,
    availableWidth = Math.max(1, width - left - 22),
    availableHeight = Math.max(1, height - top - bottom),
    panelWidth = compact
      ? availableWidth
      : Math.max(1, (availableWidth - 22) / 2),
    panelHeight = compact
      ? Math.max(1, (availableHeight - 22) / 2)
      : availableHeight,
    secondX = compact ? left : left + panelWidth + 22,
    secondY = compact ? top + panelHeight + 22 : top,
    secondPanelY = compact ? secondY + 12 : secondY,
    secondPanelHeight = compact ? Math.max(1, panelHeight - 12) : panelHeight;
  const choose = (value: number, commit: boolean) => {
    retired.delete(value);
    (commit ? committed : hovered).set(value);
  };
  const clear = () => {
    committed.set(null);
    hovered.set(null);
    pinned.set(null);
  };
  const keyMove = (event: { key: string; preventDefault(): void }) => {
    if (event.key === "Escape") {
      event.preventDefault();
      clear();
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = Math.max(
      0,
      records.findIndex((value) => value.time === (key ?? records[0].time)),
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? records.length - 1
          : Math.max(
              0,
              Math.min(
                records.length - 1,
                index + (event.key === "ArrowLeft" ? -1 : 1),
              ),
            );
    choose(records[next].time, true);
  };
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
        Linked monthly CO₂ inspection
      </Text>
      <Group style={{ translateX: 14, translateY: 35 }}>
        <Rectangle
          keyboardFocusable
          onClick={clear}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              clear();
            }
          }}
          style={{
            width: 134,
            height: 44,
            fill: "white",
            stroke: "#b7cdd0",
            strokeWidth: 1,
            cornerRadius: 5,
            cursor: "pointer",
          }}
        />
        <Label x={9} y={27} text="Clear selection" />
      </Group>
      <Group style={{ translateX: 156, translateY: 35 }}>
        <Rectangle
          keyboardFocusable
          onClick={() => {
            if (pinnedKey !== null) pinned.set(null);
            else if (key !== null) {
              retired.delete(key);
              pinned.set(key);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (pinnedKey !== null) pinned.set(null);
              else if (key !== null) {
                retired.delete(key);
                pinned.set(key);
              }
            }
          }}
          style={{
            width: 134,
            height: 44,
            fill: "white",
            stroke: "#b7cdd0",
            strokeWidth: 1,
            cornerRadius: 5,
            cursor: "pointer",
          }}
        />
        <Label
          x={9}
          y={27}
          text={pinnedKey === null ? "Pin selected" : "Unpin selection"}
        />
      </Group>
      <Label x={left} y={top - 8} text="Observed CO₂ (ppm)" size={10} />
      <Panel
        anomaly={false}
        records={records}
        selected={row}
        x={left}
        y={top}
        width={panelWidth}
        height={panelHeight}
        onChoose={choose}
        onLeave={() => hovered.set(null)}
        onKeyDown={keyMove}
        focused={focused.get()}
        onFocus={() => focused.set(true)}
        onBlur={() => focused.set(false)}
      />
      <Label
        x={secondX}
        y={compact ? secondY + 9 : secondY - 8}
        text="Anomaly vs 330 ppm"
        size={10}
      />
      <Panel
        anomaly
        records={records}
        selected={row}
        x={secondX}
        y={secondPanelY}
        width={panelWidth}
        height={secondPanelHeight}
        onChoose={choose}
        onLeave={() => hovered.set(null)}
        onKeyDown={keyMove}
        focused={focused.get()}
        onFocus={() => focused.set(true)}
        onBlur={() => focused.set(false)}
      />
      <Label
        x={14}
        y={height - 35}
        text={
          row
            ? `${month.format(row.time)} 1980 · ${row.ppm.toFixed(2)} ppm`
            : "Move, tap, or use keys to inspect an observed month."
        }
        size={10}
      />
      <Label
        x={14}
        y={height - 21}
        text={
          pinnedKey !== null && row
            ? `Pinned: ${month.format(row.time)} 1980 · ${formatAnomaly(row.ppm - 330)}`
            : "NOAA / Scripps · Mauna Loa · 1980 · ppm · UTC"
        }
        size={10}
      />
      <Label
        x={14}
        y={height - 7}
        text="Pointer / tap, Tab, ← →, Home / End · Esc clears"
        size={10}
      />
    </>
  );
}
export default function mount(
  canvas: HTMLCanvasElement,
  config: Config = {},
): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Scene input={config.data ?? defaultData} />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
