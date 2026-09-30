import {
  Absolute,
  Group,
  Line,
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

const periods = ["Q1", "Q2", "Q3", "Q4"];
const regions = ["North", "South"];
// Illustrative operating cash flow in thousands of dollars, prepared only for this lesson.
const components = [
  {
    name: "Products",
    color: "#197d70",
    values: [
      [160, 175, 190, 205],
      [135, 150, 170, 185],
    ],
  },
  {
    name: "Services",
    color: "#4e78ad",
    values: [
      [70, 76, 84, 90],
      [62, 70, 74, 82],
    ],
  },
  {
    name: "Payroll",
    color: "#c47b36",
    values: [
      [-105, -112, -120, -128],
      [-96, -102, -112, -118],
    ],
  },
  {
    name: "Operations",
    color: "#a95165",
    values: [
      [-62, -66, -71, -78],
      [-55, -61, -67, -73],
    ],
  },
] as const;

interface Segment {
  period: string;
  region: string;
  component: string;
  value: number;
  start: number;
  end: number;
  color: string;
}

function stack(): Segment[] {
  return periods.flatMap((period, periodIndex) =>
    regions.flatMap((region, regionIndex) => {
      let positive = 0;
      let negative = 0;
      return components.map((component) => {
        const value = component.values[regionIndex][periodIndex];
        const start = value >= 0 ? positive : negative;
        const end = start + value;
        if (value >= 0) positive = end;
        else negative = end;
        return {
          period,
          region,
          component: component.name,
          value,
          start,
          end,
          color: component.color,
        };
      });
    }),
  );
}

const rows = stack();
const ink = "#172b3a";
const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value)}k`;

function Button({ label, action }: { label: string; action: () => void }) {
  return (
    <Group style={{ translateX: 28, translateY: 83 }}>
      <Rectangle
        onClick={action}
        style={{
          width: 164,
          height: 32,
          cornerRadius: 6,
          fill: "#e4eae9",
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 82,
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
  horizontal,
  origin,
  selected,
}: {
  horizontal: boolean;
  origin: { x: number; y: number };
  selected: WritableSignal<Segment | null>;
}) {
  const category = useScale("periods", "band").get();
  const group = useScale("regions", "band").get();
  const value = useScale("cash").get();
  const hit = selected.get();
  function inspect(event: CRCPointerEvent) {
    const x = event.x - origin.x;
    const y = event.y - origin.y;
    selected.set(
      [...rows].reverse().find((row) => {
        const categoryStart = category.map(row.period);
        const groupStart = group.map(row.region);
        if (categoryStart === undefined || groupStart === undefined)
          return false;
        const start = value.map(row.start);
        const end = value.map(row.end);
        return horizontal
          ? y >= categoryStart + groupStart &&
              y <= categoryStart + groupStart + group.bandwidth &&
              x >= Math.min(start, end) &&
              x <= Math.max(start, end)
          : x >= categoryStart + groupStart &&
              x <= categoryStart + groupStart + group.bandwidth &&
              y >= Math.min(start, end) &&
              y <= Math.max(start, end);
      }) ?? null,
    );
  }
  const zero = value.map(0);
  return (
    <Group
      onPointerMove={inspect}
      onPointerDown={inspect}
      onPointerLeave={() => selected.set(null)}
    >
      <Axis
        scale="cash"
        position={horizontal ? "top" : "left"}
        tickCount={5}
        tickFormat={(item) => (typeof item === "number" ? money(item) : item)}
        style={{ stroke: "#a4b3b7", fill: "#637785", font: "11px sans-serif" }}
      />
      <Line
        pointerEvents="none"
        style={{
          coords: horizontal
            ? [
                [zero, 0],
                [zero, category.frame.height],
              ]
            : [
                [0, zero],
                [category.frame.width, zero],
              ],
          stroke: ink,
          strokeWidth: 1,
        }}
      />
      <BarSeries
        orientation={horizontal ? "horizontal" : "vertical"}
        data={rows}
        category="period"
        group="region"
        valueStart="start"
        valueEnd="end"
        categoryScale="periods"
        groupScale="regions"
        valueScale="cash"
        style={(row) => ({ fill: row.color })}
      />
      {periods.map((period) => {
        const start = category.map(period);
        if (start === undefined) return null;
        return (
          <Text
            key={period}
            pointerEvents="none"
            style={{
              left: horizontal ? -14 : start + category.bandwidth / 2,
              top: horizontal
                ? start + category.bandwidth / 2
                : category.frame.height + 23,
              textAlign: horizontal ? "right" : "center",
              textBaseline: horizontal ? "middle" : "alphabetic",
              font: "12px sans-serif",
              fill: ink,
            }}
          >
            {period}
          </Text>
        );
      })}
      <Text
        pointerEvents="none"
        style={{
          left: horizontal ? 0 : -35,
          top: category.frame.height + 56,
          font: "13px sans-serif",
          fill: ink,
        }}
      >
        {hit
          ? `${hit.period} · ${hit.region} · ${hit.component} · ${money(hit.value)}`
          : "Hover or tap a segment for its regional cash flow"}
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: horizontal ? 0 : -35,
          top: category.frame.height + 81,
          font: "11px sans-serif",
          fill: "#637785",
        }}
      >
        {horizontal
          ? "Stacks reset per region · inflows right of zero · outflows left of zero"
          : "Stacks reset per region · inflows above zero · outflows below zero"}
      </Text>
    </Group>
  );
}

function Scene() {
  const box = useLayoutBox();
  const horizontal = useSignal(false);
  const selected = useSignal<Segment | null>(null);
  const narrow = box.width < 500;
  const origin = { x: horizontal.get() ? 88 : 72, y: narrow ? 231 : 189 };
  const width = Math.max(210, box.width - origin.x - 36);
  const height = Math.max(150, box.height - origin.y - 104);
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#fffdf8" }}
      />
      <Text
        style={{ left: 28, top: 25, font: "bold 26px sans-serif", fill: ink }}
      >
        Regional cash flow
      </Text>
      <Text
        style={{ left: 28, top: 59, font: "12px sans-serif", fill: "#637785" }}
      >
        Illustrative quarterly stacks · two regions per quarter
      </Text>
      <Button
        label="Toggle orientation"
        action={() => {
          horizontal.set(!horizontal.get());
          selected.set(null);
        }}
      />
      <Text
        pointerEvents="none"
        style={{ left: 214, top: 103, font: "12px sans-serif", fill: ink }}
      >
        {horizontal.get() ? "Horizontal bars" : "Vertical bars"}
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 28, top: 126, font: "11px sans-serif", fill: "#637785" }}
      >
        Within each quarter: North slot first · South slot second
      </Text>
      {components.map((component, index) => (
        <Group
          key={component.name}
          style={{ translateX: 28 + index * 142, translateY: origin.y - 31 }}
        >
          <Rectangle
            style={{
              width: 12,
              height: 12,
              fill: component.color,
            }}
          />
          <Text
            style={{ left: 19, top: 10, font: "12px sans-serif", fill: ink }}
          >
            {component.name}
          </Text>
        </Group>
      ))}
      <Group style={{ translateX: origin.x, translateY: origin.y }}>
        <Absolute style={{ width, height }}>
          <Scale
            id="periods"
            type="band"
            domain={periods}
            range={horizontal.get() ? "height" : "width"}
            paddingInner={0.3}
            paddingOuter={0.18}
            style={{ width, height }}
          >
            <Scale
              id="regions"
              type="band"
              domain={regions}
              range={{ bandwidthOf: "periods" }}
              paddingInner={0.12}
              paddingOuter={0.04}
            >
              <Scale
                id="cash"
                type="linear"
                domain={[-240, 420]}
                range={horizontal.get() ? "width" : "height"}
                reverse={!horizontal.get()}
              >
                <Plot
                  horizontal={horizontal.get()}
                  origin={origin}
                  selected={selected}
                />
              </Scale>
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
