import {
  Absolute,
  Group,
  Line,
  Rectangle,
  Text,
  pibbl,
  useLayoutBox,
  useSignal,
  type PibblController,
  type PibblPointerEvent,
  type WritableSignal,
} from "@pibbl/core";
import { Axis, BarSeries, useBarScale, useLinearScale, BarScale, LinearScale } from "@pibbl/core/viz";

const periods = ["Q1", "Q2", "Q3", "Q4"];
// Illustrative business cash flow, in thousands of dollars; not reported financial data.
const components = [
  { name: "Products", color: "#197d70", values: [180, 225, 210, 285] },
  { name: "Services", color: "#4e78ad", values: [90, 105, 125, 140] },
  { name: "Payroll", color: "#c47b36", values: [-120, -135, -145, -160] },
  { name: "Operations", color: "#a95165", values: [-75, -85, -90, -105] },
];
interface Segment {
  period: string;
  component: string;
  value: number;
  start: number;
  end: number;
  color: string;
}
// Stacking is ordinary pure data preparation. Order comes from the selected
// components; positive and negative totals accumulate independently per period.
// Missing/nonfinite values are omitted, and never advance either accumulator.
function stack(selected: readonly (typeof components)[number][]): Segment[] {
  return periods.flatMap((period, index) => {
    let positive = 0,
      negative = 0;
    return selected.flatMap((component) => {
      const value = component.values[index];
      if (!Number.isFinite(value)) return [];
      const start = value >= 0 ? positive : negative;
      const end = start + value;
      if (value >= 0) positive = end;
      else negative = end;
      return [
        {
          period,
          component: component.name,
          value,
          start,
          end,
          color: component.color,
        },
      ];
    });
  });
}
const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value)}k`;
const ink = "#172b3a";
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
        onClick={action}
        style={{
          width: 138,
          height: 32,
          cornerRadius: 6,
          fill: "#e4eae9",
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 69,
          top: 16,
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
function Plot({
  rows,
  origin,
  selected,
}: {
  rows: readonly Segment[];
  origin: { x: number; y: number };
  selected: WritableSignal<Segment | null>;
}) {
  const periods = useBarScale("periods").get();
  const cash = useLinearScale("cash").get();
  function inspect(event: PibblPointerEvent) {
    const x = event.x - origin.x,
      y = event.y - origin.y;
    // Reverse search matches the renderer's source paint order at shared edges.
    selected.set(
      [...rows].reverse().find((row) => {
        const start = periods.map(row.period);
        const y0 = cash.map(row.start),
          y1 = cash.map(row.end);
        return (
          start !== undefined &&
          row.start !== row.end &&
          x >= start &&
          x <= start + periods.bandwidth &&
          y >= Math.min(y0, y1) &&
          y <= Math.max(y0, y1)
        );
      }) ?? null,
    );
  }
  const hit = selected.get();
  return (
    <Group
      onPointerMove={inspect}
      onPointerDown={inspect}
      onPointerLeave={() => selected.set(null)}
    >
      <Axis
        scale="cash"
        position="left"
        tickCount={cash.frame.height >= 250 ? 9 : 5}
        tickFormat={(value) => typeof value === "number" ? money(value) : value}
        style={{ stroke: "#a4b3b7", fill: "#637785", font: "11px sans-serif" }}
      />
      <BarSeries
        data={rows}
        category="period"
        valueStart="start"
        valueEnd="end"
        categoryScale="periods"
        valueScale="cash"
        style={(row) => ({ fill: row.color })}
      />
      <Line
        pointerEvents="none"
        style={{
          coords: [
            [0, cash.map(0)],
            [periods.frame.width, cash.map(0)],
          ],
          stroke: ink,
          strokeWidth: 1,
        }}
      />
      {periods.domain.map((period) => (
        <Text
          key={period}
          pointerEvents="none"
          style={{
            left: periods.map(period)! + periods.bandwidth / 2,
            top: periods.frame.height + 23,
            textAlign: "center",
            font: "12px sans-serif",
            fill: ink,
          }}
        >
          {period}
        </Text>
      ))}
      <Text
        pointerEvents="none"
        style={{
          left: -35,
          top: periods.frame.height + 55,
          font: "13px sans-serif",
          fill: ink,
        }}
      >
        {hit
          ? `${hit.period} · ${hit.component} · ${money(hit.value)}`
          : "Hover or tap a segment for its cash flow"}
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: -35,
          top: periods.frame.height + 80,
          font: "11px sans-serif",
          fill: "#637785",
        }}
      >
        Inflows above zero · Outflows below zero
      </Text>
    </Group>
  );
}
function Scene() {
  const box = useLayoutBox();
  const reversed = useSignal(false);
  const costs = useSignal(true);
  const compact = useSignal(false);
  const selected = useSignal<Segment | null>(null);
  let visible = components.filter((_, i) => costs.get() || i < 2);
  if (reversed.get()) visible = [...visible].reverse();
  const rows = stack(visible);
  const narrow = box.width < 500;
  const origin = { x: 72, y: narrow ? 253 : 209 };
  const width = Math.max(210, (box.width - 108) * (compact.get() ? 0.75 : 1));
  const height = Math.max(80, box.height - origin.y - 100);
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#fffdf8" }}
      />
      <Text style={{ left: 28, top: 25, font: "bold 26px sans-serif", fill: ink }}>
        Quarterly cash flow
      </Text>
      <Text style={{ left: 28, top: 59, font: "12px sans-serif", fill: "#637785" }}>
        Illustrative business · amounts in $ thousands
      </Text>
      <Button
        x={28}
        y={83}
        label="Reverse stack"
        action={() => {
          reversed.set(!reversed.get());
          selected.set(null);
        }}
      />
      <Button
        x={178}
        y={83}
        label={costs.get() ? "Hide costs" : "Show costs"}
        action={() => {
          costs.set(!costs.get());
          selected.set(null);
        }}
      />
      <Button
        x={narrow ? 28 : 328}
        y={narrow ? 125 : 83}
        label="Resize plot"
        action={() => compact.set(!compact.get())}
      />
      {visible.map((component, index) => (
        <Group
          key={component.name}
          style={{
            translateX: 28 + (index % 2) * 165,
            translateY: origin.y - 65 + Math.floor(index / 2) * 23,
          }}
        >
          <Rectangle style={{ width: 12, height: 12, fill: component.color }} />
          <Text style={{ left: 19, top: 10, font: "12px sans-serif", fill: ink }}>
            {component.name}
          </Text>
        </Group>
      ))}
      <Group style={{ translateX: origin.x, translateY: origin.y }}>
        <Absolute style={{ width, height }}>
          <BarScale
            id="periods"

            domain={periods}
            range="width"
            paddingInner={0.35}
            paddingOuter={0.2}
            style={{ width, height }}
          >
            <LinearScale
              id="cash"

              domain={[-300, 500]}
              range="height"
              reverse
            >
              <Plot rows={rows} origin={origin} selected={selected} />
            </LinearScale>
          </BarScale>
        </Absolute>
      </Group>
    </Group>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <Scene />, { viewport: "responsive" });
}
