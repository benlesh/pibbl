import {
  Circle,
  FocusManagement,
  Group,
  Overlay,
  Rectangle,
  Text,
  pibbl,
  resolveSignalValue,
  useLayoutBox,
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
  useLinearScale,
} from "@pibbl/core/viz";

// NOAA GML / Scripps monthly Mauna Loa CO2 means, ppm, Jan–Dec 1980.
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
const observations = [
  337.9, 338.34, 340.07, 340.93, 341.45, 341.36, 339.45, 337.67, 336.25, 336.14,
  337.3, 338.29,
].map((ppm, month) => ({ month, position: month % 3, ppm }));
type Observation = {
  readonly month: number;
  readonly position: number;
  readonly ppm: number | null;
};
type Config = { readonly data?: SignalValue<readonly Observation[]> };
const ink = "#172f3d",
  muted = "#526975",
  teal = "#087f8c";
const quarterNames = [
  "Q1 · Jan–Mar",
  "Q2 · Apr–Jun",
  "Q3 · Jul–Sep",
  "Q4 · Oct–Dec",
];
const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const sharedDomain: readonly [number, number] = [335, 343];

function Label({
  x,
  y,
  text,
  size = 10,
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

function PanelBody({
  rows,
  xScale,
  yScale,
  selected,
  originX,
  width,
  height,
  onSelect,
}: {
  rows: readonly Observation[];
  xScale: string;
  yScale: string;
  selected: number | null;
  originX: number;
  width: number;
  height: number;
  onSelect: (position: number | null) => void;
}) {
  const focused = useSignal(false);
  const x = useLinearScale(xScale).get(),
    y = useLinearScale(yScale).get();
  const row =
    selected === null
      ? undefined
      : rows.find((item) => item.position === selected);
  const choose = (event: PibblPointerEvent) => {
    if (rows.length === 0) return;
    const value = x.invert(event.x - originX);
    let nearest = rows[0];
    for (const item of rows)
      if (Math.abs(item.position - value) < Math.abs(nearest.position - value))
        nearest = item;
    onSelect(nearest.position);
  };
  return (
    <>
      <GridLines scale={yScale} direction="horizontal" span={[0, width]} />
      <LineSeries
        data={rows}
        x="position"
        y={(item) => item.ppm}
        xScale={xScale}
        yScale={yScale}
        pointerEvents="none"
        style={{ stroke: teal, strokeWidth: 2 }}
      />
      <Axis
        scale={yScale}
        position="left"
        tickValues={height < 45 ? y.domain : undefined}
        labelOverlap="skip"
        tickFormat={(value) => Number(value).toFixed(1)}
        style={{ font: "9px sans-serif", fill: muted }}
      />
      <Axis
        scale={xScale}
        position="bottom"
        tickValues={[0, 1, 2]}
        tickFormat={(value) =>
          monthNames[Number(value) + Math.floor(Number(xScale.slice(2)) * 3)]
        }
        style={{ font: "9px sans-serif", fill: muted }}
      />
      {row && row.ppm !== null && (
        <Circle
          pointerEvents="none"
          style={{
            cx: x.map(row.position),
            cy: y.map(row.ppm),
            radius: 3.5,
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
        onPointerMove={choose}
        onPointerDown={choose}
        onKeyDown={(event) => {
          if (["Home", "End", "Escape"].includes(event.key)) {
            event.preventDefault();
            onSelect(
              event.key === "Escape" ? null : event.key === "Home" ? 0 : 2,
            );
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            onSelect(
              Math.max(
                0,
                Math.min(
                  2,
                  (selected ?? 0) + (event.key === "ArrowLeft" ? -1 : 1),
                ),
              ),
            );
          }
        }}
        style={{
          width,
          height,
          fill: "transparent",
          cursor: "crosshair",
          stroke: focused.get() ? ink : "transparent",
          strokeWidth: 2,
        }}
      />
    </>
  );
}

function QuarterPanel({
  rows,
  index,
  x,
  y,
  width,
  height,
  shared,
  selected,
  onSelect,
}: {
  rows: readonly Observation[];
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shared: boolean;
  selected: number | null;
  onSelect: (position: number | null) => void;
}) {
  const values = rows.flatMap((row) => (row.ppm === null ? [] : [row.ppm]));
  const localMin = values.length === 0 ? 335 : Math.min(...values),
    localMax = values.length === 0 ? 343 : Math.max(...values);
  const domain: readonly [number, number] = shared
    ? sharedDomain
    : localMin === localMax
      ? [localMin - 1, localMax + 1]
      : [localMin - 0.4, localMax + 0.4];
  return (
    <>
      <Label x={x} y={y - 21} text={quarterNames[index]} />
      <Label
        x={x}
        y={y - 8}
        size={9}
        text={
          selected === null ||
          rows.find((row) => row.position === selected)?.ppm == null
            ? "no observation"
            : `${rows.find((row) => row.position === selected)!.ppm!.toFixed(2)} ppm`
        }
      />
      <Group style={{ translateX: x, translateY: y }}>
        <Overlay style={{ width, height }}>
          <LinearScale
            id={`x-${index}`}
            domain={[0, 2]}
            range="width"
            style={{ width: "100%", height: "100%" }}
          >
            <LinearScale
              id={`y-${index}`}
              domain={domain}
              range="height"
              reverse
            >
              <PanelBody
                rows={rows}
                xScale={`x-${index}`}
                yScale={`y-${index}`}
                selected={selected}
                originX={x}
                width={width}
                height={height}
                onSelect={onSelect}
              />
            </LinearScale>
          </LinearScale>
        </Overlay>
      </Group>
    </>
  );
}

function Scene({ input }: { input: SignalValue<readonly Observation[]> }) {
  const { width, height } = useLayoutBox();
  const data = resolveSignalValue(input);
  const shared = useSignal(true),
    selected = useSignal<number | null>(null),
    buttonFocus = useSignal(false);
  const columns = width >= 460 || height <= 400 ? 2 : 1;
  const gap = 46,
    left = 40,
    top = 110,
    footer = 58;
  const panelWidth = Math.max(
    1,
    (width - left - 14 - gap * (columns - 1)) / columns,
  );
  const panelHeight = Math.max(
    1,
    (height - top - footer - gap * (4 / columns - 1)) / (4 / columns),
  );
  const quarters = Array.from({ length: 4 }, (_, index) =>
    Array.from(
      { length: 3 },
      (_, position) =>
        data.find((row) => row.month === index * 3 + position) ?? {
          month: index * 3 + position,
          position,
          ppm: null,
        },
    ),
  );
  return (
    <>
      <Rectangle style={{ width, height, fill: "#f7faf9" }} />
      <Text
        pointerEvents="none"
        style={{
          left: 14,
          top: 24,
          font: "600 21px sans-serif",
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
        1980 quarterly CO₂
      </Text>
      <Group style={{ translateX: 14, translateY: 35 }}>
        <Rectangle
          keyboardFocusable
          onFocus={() => buttonFocus.set(true)}
          onBlur={() => buttonFocus.set(false)}
          onClick={() => shared.set(!shared.get())}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              shared.set(!shared.get());
            }
          }}
          style={{
            width: 206,
            height: 44,
            fill: "white",
            stroke: buttonFocus.get() ? ink : "#b7cdd0",
            strokeWidth: buttonFocus.get() ? 2 : 1,
            cornerRadius: 5,
            cursor: "pointer",
          }}
        />
        <Label
          x={9}
          y={27}
          text={
            shared.get() ? "Use independent y domains" : "Use shared y domain"
          }
        />
      </Group>
      {quarters.map((rows, index) => (
        <QuarterPanel
          key={index}
          rows={rows}
          index={index}
          x={left + (index % columns) * (panelWidth + gap)}
          y={top + Math.floor(index / columns) * (panelHeight + gap)}
          width={panelWidth}
          height={panelHeight}
          shared={shared.get()}
          selected={selected.get()}
          onSelect={(position) => selected.set(position)}
        />
      ))}
      <Label
        x={14}
        y={height - 26}
        text={
          selected.get() === null
            ? "Align quarters by month position (1–3)."
            : `Aligned month-of-quarter: ${selected.get()! + 1} of 3`
        }
      />
      <Label
        x={14}
        y={height - 10}
        text="NOAA / Scripps · Mauna Loa · 1980 · ppm"
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
      <Scene input={config.data ?? observations} />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
