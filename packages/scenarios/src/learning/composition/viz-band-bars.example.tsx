import {
  Absolute,
  Group,
  Line,
  Path,
  Rectangle,
  Text,
  crc,
  useLayoutBox,
  useSignal,
  type CRCController,
  type CRCPointerEvent,
  type WritableSignal,
} from "@crc/core";
import { Axis, BarSeries, Scale, useScale } from "@crc/viz";

interface Reading {
  category: string;
  value: number;
}
// Census Bureau, Vintage 2023 estimates (published December 19, 2023).
// Six most populous states in that release; July 1, 2022 to July 1, 2023 change.
// Historical snapshot: later estimate vintages may revise these figures.
// https://www.census.gov/newsroom/press-releases/2023/population-trends-return-to-pre-pandemic-norms.html
const initial: readonly Reading[] = [
  { category: "California", value: -75423 },
  { category: "Texas", value: 473453 },
  { category: "Florida", value: 365205 },
  { category: "New York", value: -101984 },
  { category: "Pennsylvania", value: -10408 },
  { category: "Illinois", value: -32826 },
];
const abbreviations: Readonly<Record<string, string>> = {
  California: "CA",
  Texas: "TX",
  Florida: "FL",
  "New York": "NY",
  Pennsylvania: "PA",
  Illinois: "IL",
};
const ink = "#172b3a",
  muted = "#637785",
  green = "#167b70",
  orange = "#c36638";
const signed = (value: number) =>
  value === 0
    ? "0"
    : `${value > 0 ? "+" : "−"}${Math.abs(value / 1000).toFixed(1)}k`;
const exact = (value: number) =>
  `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString("en-US")}`;

function Button({
  x,
  y,
  label,
  action,
}: {
  x: number;
  y: number;
  label: string;
  action: () => void;
}) {
  return (
    <Group style={{ translateX: x, translateY: y }}>
      <Rectangle
        style={{
          width: 138,
          height: 34,
          cornerRadius: 6,
          fill: "#e4eae9",
          cursor: "pointer",
        }}
        onClick={action}
      />
      <Text
        pointerEvents="none"
        style={{
          x: 69,
          y: 17,
          textAlign: "center",
          textBaseline: "middle",
          font: "12px sans-serif",
          fill: ink,
        }}
      >
        {label}
      </Text>
    </Group>
  );
}

function Bars({
  rows,
  selected,
  origin,
}: {
  rows: readonly Reading[];
  selected: WritableSignal<string | null>;
  origin: { x: number; y: number };
}) {
  const band = useScale("states", "band").get();
  const values = useScale("change").get();
  const baseline = values.map(0);
  const thresholdY = values.map(300_000);
  const thresholdDots = new Path2D();
  for (let x = 0; x <= band.frame.width; x += 6) {
    thresholdDots.moveTo(x + 1, thresholdY);
    thresholdDots.arc(x, thresholdY, 1, 0, Math.PI * 2);
  }
  const active = selected.get();
  function inspect(event: CRCPointerEvent) {
    const x = event.x - origin.x,
      y = event.y - origin.y;
    const hit = [...rows].reverse().find((row) => {
      const start = band.map(row.category);
      if (start === undefined || row.value === 0) return false;
      const end = values.map(row.value);
      return (
        x >= start &&
        x <= start + band.bandwidth &&
        y >= Math.min(end, baseline) &&
        y <= Math.max(end, baseline)
      );
    });
    selected.set(hit?.category ?? null);
  }
  const hit = rows.find((row) => row.category === active);
  return (
    <Group
      onPointerMove={inspect}
      onPointerDown={inspect}
      onPointerLeave={() => selected.set(null)}
    >
      <Rectangle
        style={{
          width: band.frame.width,
          height: band.frame.height,
          fill: "#fffdf8",
        }}
      />
      {[-200000, -100000, 100000, 200000, 300000, 400000, 500000].map(
        (tick) => (
          <Line
            key={tick}
            pointerEvents="none"
            style={{
              coords: [
                [0, values.map(tick)],
                [band.frame.width, values.map(tick)],
              ],
              stroke: "#e8ebe6",
              strokeWidth: 1,
            }}
          />
        ),
      )}
      <Axis
        scale="change"
        position="left"
        tickCount={8}
        tickFormat={(value) => (value === 0 ? "0" : `${value / 1000}k`)}
        style={{ fill: muted, stroke: "#b5c0bf" }}
      />
      <BarSeries
        data={rows}
        x="category"
        y="value"
        xScale="states"
        yScale="change"
        style={{
          fill: {
            type: "threshold",
            thresholds: [0, 300_000],
            colors: [orange, green, "#c43c39"],
          },
        }}
      />
      <Line
        pointerEvents="none"
        style={{
          coords: [
            [0, baseline],
            [band.frame.width, baseline],
          ],
          stroke: ink,
          strokeWidth: 1,
        }}
      />
      <Path
        pointerEvents="none"
        style={{ d: thresholdDots, fill: "#8d3432" }}
      />
      <Text
        pointerEvents="none"
        style={{
          x: band.frame.width - 5,
          y: thresholdY - 10,
          textAlign: "right",
          textBaseline: "bottom",
          font: "11px sans-serif",
          fill: "#8d3432",
        }}
      >
        300k · color threshold
      </Text>
      {rows.map((row) => {
        const start = band.map(row.category);
        if (start === undefined) return null;
        const center = start + band.bandwidth / 2;
        const end = values.map(row.value);
        return (
          <Group key={row.category}>
            <Text
              pointerEvents="none"
              style={{
                x: center,
                y: band.frame.height + 18,
                textAlign: "center",
                font: "12px sans-serif",
                fill: muted,
              }}
            >
              {band.step < 105 ? abbreviations[row.category] : row.category}
            </Text>
            <Text
              pointerEvents="none"
              style={{
                x: center,
                y: end + (row.value < 0 ? 12 : -20),
                textAlign: "center",
                font: "bold 13px sans-serif",
                fill: ink,
              }}
            >
              {signed(row.value)}
            </Text>
          </Group>
        );
      })}
      <Text
        pointerEvents="none"
        style={{
          x: 0,
          y: band.frame.height + 61,
          font: "bold 15px sans-serif",
          fill: ink,
        }}
      >
        {hit
          ? `${hit.category} · ${exact(hit.value)} residents`
          : "Hover or tap a bar for the exact population change"}
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 0,
          y: band.frame.height + 88,
          font: "11px sans-serif",
          fill: muted,
        }}
      >
        Source: U.S. Census Bureau · Vintage 2023 estimates
      </Text>
    </Group>
  );
}

function Scene() {
  const box = useLayoutBox();
  const order = useSignal<readonly string[]>(
    initial.map((row) => row.category),
  );
  const padding = useSignal(0.3);
  const compact = useSignal(false);
  const selected = useSignal<string | null>(null);
  const narrow = box.width < 480;
  const origin = { x: 65, y: narrow ? 240 : 190 };
  const width = Math.max(260, (box.width - 100) * (compact.get() ? 0.75 : 1));
  const height = Math.max(60, box.height - origin.y - 110);
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#fffdf8" }}
      />
      <Text
        pointerEvents="none"
        style={{ x: 28, y: 25, font: "bold 27px sans-serif", fill: ink }}
      >
        Annual population change
      </Text>
      <Text
        pointerEvents="none"
        style={{ x: 28, y: 64, font: "13px sans-serif", fill: muted }}
      >
        Six most populous U.S. states · July 2022–July 2023
      </Text>
      <Button
        x={28}
        y={96}
        label="Reverse order"
        action={() => order.set([...order.get()].reverse())}
      />
      <Button
        x={178}
        y={96}
        label="Change spacing"
        action={() => padding.set(padding.get() === 0.3 ? 0.65 : 0.3)}
      />
      <Button
        x={narrow ? 28 : 328}
        y={narrow ? 140 : 96}
        label="Resize plot"
        action={() => compact.set(!compact.get())}
      />
      <Text
        pointerEvents="none"
        style={{
          x: 28,
          y: origin.y - 42,
          font: "11px sans-serif",
          fill: muted,
        }}
      >
        Orange: below 0 · Green: 0–300k · Red: above 300k
      </Text>
      <Group style={{ translateX: origin.x, translateY: origin.y }}>
        <Absolute style={{ width, height }}>
          <Scale
            id="states"
            type="band"
            domain={order}
            range="width"
            style={{ width, height }}
            paddingInner={padding}
            paddingOuter={0.2}
          >
            <Scale
              id="change"
              type="linear"
              domain={[-200000, 500000]}
              range="height"
              reverse
            >
              <Bars rows={initial} selected={selected} origin={origin} />
            </Scale>
          </Scale>
        </Absolute>
      </Group>
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <Scene />, { viewport: "responsive" });
}
