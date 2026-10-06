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
  PlotSeries,
  PointScale,
  SymlogScale,
  usePointScale,
} from "@pibbl/core/viz";

// U.S. Census Bureau, Vintage 2023 estimates: July 1, 2022–July 1, 2023 change.
// https://www.census.gov/newsroom/press-releases/2023/population-trends-return-to-pre-pandemic-norms.html
const data = [
  { state: "CA", change: -75423 },
  { state: "TX", change: 473453 },
  { state: "FL", change: 365205 },
  { state: "NY", change: -101984 },
  { state: "PA", change: -10408 },
  { state: "IL", change: -32826 },
] as const;
type Datum = { readonly state: string; readonly change: number };
type Config = { readonly data?: readonly Datum[] };
const ink = "#172f3d",
  muted = "#526975",
  positive = "#087f8c",
  negative = "#b45309",
  maximumArea = 1100;
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
function checked(rows: readonly Datum[]) {
  let maximum = 0;
  for (const row of rows) {
    if (!Number.isFinite(row.change))
      throw new RangeError("Population change must be finite.");
    maximum = Math.max(maximum, Math.abs(row.change));
  }
  return maximum;
}
function Marks({
  rows,
  selected,
  circles,
  left,
  onSelect,
}: {
  rows: readonly Datum[];
  selected: string | null;
  circles: boolean;
  left: number;
  onSelect: (state: string | null) => void;
}) {
  const x = usePointScale("state").get(),
    focus = useSignal(false),
    maximum = checked(rows);
  const choose = (event: PibblPointerEvent) => {
    const state = x.invert(event.x - left);
    if (typeof state === "string" && rows.some((row) => row.state === state))
      onSelect(state);
  };
  const step = (direction: number) => {
    const index = Math.max(
      0,
      rows.findIndex((row) => row.state === selected),
    );
    onSelect(
      rows[Math.max(0, Math.min(rows.length - 1, index + direction))]?.state ??
        null,
    );
  };
  return (
    <>
      <PlotSeries
        data={rows}
        x="state"
        y="change"
        xScale="state"
        yScale="change"
        keyBy="state"
        defined={(row) => row.change !== 0}
        render={(row) => {
          const area =
              maximum === 0
                ? 0
                : (maximumArea * Math.abs(row.change)) / maximum,
            side = Math.sqrt(area),
            circle = row.change > 0 || circles,
            stroke = selected === row.state ? ink : "white",
            strokeWidth = selected === row.state ? 2 : 1;
          return circle ? (
            <Circle
              pointerEvents="none"
              style={{
                radius: Math.sqrt(area / Math.PI),
                fill: row.change > 0 ? positive : negative,
                stroke,
                strokeWidth,
              }}
            />
          ) : (
            <Rectangle
              pointerEvents="none"
              style={{
                left: -side / 2,
                top: -side / 2,
                width: side,
                height: side,
                fill: negative,
                stroke,
                strokeWidth,
              }}
            />
          );
        }}
      />
      <Rectangle
        keyboardFocusable
        onFocus={() => focus.set(true)}
        onBlur={() => focus.set(false)}
        onPointerMove={choose}
        onPointerDown={choose}
        onKeyDown={(event) => {
          if (
            [
              "ArrowLeft",
              "ArrowUp",
              "ArrowRight",
              "ArrowDown",
              "Home",
              "End",
            ].includes(event.key)
          ) {
            event.preventDefault();
            if (event.key === "Home") onSelect(rows[0]?.state ?? null);
            else if (event.key === "End") onSelect(rows.at(-1)?.state ?? null);
            else
              step(
                event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1,
              );
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onSelect(null);
          }
        }}
        style={{
          width: "100%",
          height: "100%",
          fill: "transparent",
          stroke: focus.get() ? ink : undefined,
          strokeWidth: 2,
          cursor: "crosshair",
        }}
      />
    </>
  );
}
function Scene({ rows }: { rows: readonly Datum[] }) {
  const { width, height } = useLayoutBox(),
    selected = useSignal<string | null>(null),
    circles = useSignal(false),
    buttonFocus = useSignal(false),
    left = 58,
    top = 101,
    plotWidth = Math.max(1, width - left - 18),
    plotHeight = Math.max(52, height - top - 78),
    chosen = rows.find((row) => row.state === selected.get());
  checked(rows);
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
        State population change
      </Text>
      <Group style={{ translateX: 14, translateY: 35 }}>
        <Rectangle
          keyboardFocusable
          onFocus={() => buttonFocus.set(true)}
          onBlur={() => buttonFocus.set(false)}
          onClick={() => circles.set(!circles.get())}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              circles.set(!circles.get());
            }
          }}
          style={{
            width: 180,
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
          text={circles.get() ? "Use sign shapes" : "Use circles only"}
        />
      </Group>
      <Label x={14} y={92} text="Y: symlog · population change in people" />
      <Group style={{ translateX: left, translateY: top }}>
        <Overlay style={{ width: plotWidth, height: plotHeight }}>
          <PointScale
            id="state"
            domain={rows.map((row) => row.state)}
            range="width"
            padding={0.7}
            style={{ width: "100%", height: "100%" }}
          >
            <SymlogScale
              id="change"
              domain={[-150000, 500000]}
              range={[plotHeight - 20, 20]}
              constant={10000}
            >
              <Axis
                scale="change"
                position="left"
                tickValues={[-100000, 0, 100000, 500000]}
                style={{ font: "10px sans-serif", fill: muted }}
              />
              <Axis
                scale="state"
                position="bottom"
                tickValues={rows.map((row) => row.state)}
                style={{ font: "10px sans-serif", fill: muted }}
              />
              <Marks
                rows={rows}
                selected={selected.get()}
                circles={circles.get()}
                left={left}
                onSelect={(state) => selected.set(state)}
              />
            </SymlogScale>
          </PointScale>
        </Overlay>
      </Group>
      <Label
        x={14}
        y={height - 49}
        text={
          chosen
            ? `${chosen.state}: ${chosen.change.toLocaleString()} people`
            : "Select a state to read its observed change."
        }
      />
      <Label
        x={14}
        y={height - 34}
        text={
          circles.get()
            ? "Area = |change| · teal = gain · ochre = loss"
            : "Area = |change| · circle = gain · square = loss"
        }
      />
      <Label
        x={14}
        y={height - 19}
        text="Census Bureau · Vintage 2023 · July 2022–July 2023 · people"
      />
      <Label
        x={14}
        y={height - 6}
        text="Source: Census Bureau release CB23-217 · population estimates"
        size={9}
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
      <Scene rows={config.data ?? data} />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
