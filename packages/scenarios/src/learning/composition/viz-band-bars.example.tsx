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
import { Axis, BarSeries, Scale, useScale } from "@crc/core/viz";

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
          left: 69,
          top: 17,
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
  orientation,
}: {
  rows: readonly Reading[];
  selected: WritableSignal<string | null>;
  origin: { x: number; y: number };
  orientation: "vertical" | "horizontal";
}) {
  const band = useScale("states", "band").get();
  const values = useScale("change").get();
  const baseline = values.map(0);
  const thresholdY = values.map(300_000);
  const thresholdDots = new Path2D();
  if (orientation === "horizontal") {
    for (let y = 0; y <= band.frame.height; y += 6) {
      thresholdDots.moveTo(thresholdY + 1, y);
      thresholdDots.arc(thresholdY, y, 1, 0, Math.PI * 2);
    }
  } else
    for (let x = 0; x <= band.frame.width; x += 6) {
      thresholdDots.moveTo(x + 1, thresholdY);
      thresholdDots.arc(x, thresholdY, 1, 0, Math.PI * 2);
    }
  const active = selected.get();
  const horizontal = orientation === "horizontal";
  function inspect(event: CRCPointerEvent) {
    const x = event.x - origin.x,
      y = event.y - origin.y;
    const hit = [...rows].reverse().find((row) => {
      const start = band.map(row.category);
      if (start === undefined || row.value === 0) return false;
      const end = values.map(row.value);
      return (
        horizontal
          ? x >= Math.min(end, baseline) &&
            x <= Math.max(end, baseline) &&
            y >= start &&
            y <= start + band.bandwidth
          : x >= start &&
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
                horizontal
                  ? [values.map(tick), 0]
                  : [0, values.map(tick)],
                horizontal
                  ? [values.map(tick), band.frame.height]
                  : [band.frame.width, values.map(tick)],
              ],
              stroke: "#e8ebe6",
              strokeWidth: 1,
            }}
          />
        ),
      )}
      <Axis
        scale="states"
        position={horizontal ? "left" : "bottom"}
        tickValues={band.domain}
        tickFormat={(value) =>
          typeof value === "string" && band.step < 105
            ? abbreviations[value]
            : String(value)}
        style={{ fill: muted, stroke: "#b5c0bf" }}
      />
      <Axis
        scale="change"
        position={horizontal ? "top" : "left"}
        tickCount={8}
        tickFormat={(value) =>
          typeof value === "number" && value === 0 ? "0" : `${Number(value) / 1000}k`}
        style={{ fill: muted, stroke: "#b5c0bf" }}
      />
      <BarSeries
        orientation={orientation}
        data={rows}
        category="category"
        value="value"
        categoryScale="states"
        valueScale="change"
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
            horizontal ? [baseline, 0] : [0, baseline],
            horizontal ? [baseline, band.frame.height] : [band.frame.width, baseline],
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
          left: horizontal ? thresholdY + 5 : band.frame.width - 5,
          top: horizontal ? 5 : thresholdY - 10,
          textAlign: horizontal ? "left" : "right",
          textBaseline: horizontal ? "top" : "bottom",
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
                left: horizontal ? end + (row.value < 0 ? -8 : 8) : center,
                top: horizontal ? center : end + (row.value < 0 ? 12 : -20),
                textAlign: horizontal ? row.value < 0 ? "right" : "left" : "center",
                textBaseline: horizontal ? "middle" : "alphabetic",
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
          left: 0,
          top: band.frame.height + 61,
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
          left: 0,
          top: band.frame.height + 88,
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
  const orientation = useSignal<"vertical" | "horizontal">("vertical");
  const selected = useSignal<string | null>(null);
  const mode = orientation.get();
  const narrow = box.width < 480;
  const origin = { x: mode === "horizontal" ? 128 : 65, y: narrow ? 240 : 190 };
  const width = Math.max(220, (box.width - origin.x - 35) * (compact.get() ? 0.75 : 1));
  const height = Math.max(60, box.height - origin.y - 110);
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#fffdf8" }}
      />
      <Text
        pointerEvents="none"
        style={{ left: 28, top: 25, font: "bold 27px sans-serif", fill: ink }}
      >
        Annual population change
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 28, top: 64, font: "13px sans-serif", fill: muted }}
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
      <Button
        x={narrow ? 178 : 478}
        y={narrow ? 140 : 96}
        label={mode === "vertical" ? "Horizontal bars" : "Vertical bars"}
        action={() =>
          orientation.set(
            orientation.get() === "vertical" ? "horizontal" : "vertical",
          )}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 28,
          top: origin.y - 42,
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
            range={mode === "horizontal" ? "height" : "width"}
            style={{ width, height }}
            paddingInner={padding}
            paddingOuter={0.2}
          >
            <Scale
              id="change"
              type="linear"
              domain={[-200000, 500000]}
              range={mode === "horizontal" ? "width" : "height"}
              reverse={mode === "vertical"}
            >
              <Bars
                rows={initial}
                selected={selected}
                origin={origin}
                orientation={mode}
              />
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
