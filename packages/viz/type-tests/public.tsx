import { createElement, signal, type CRCNode } from "@crc/core";
import {
  Scale,
  Axis,
  LineSeries,
  ScaleAdjust,
  useScale,
  type ScaleProps,
  type ResolvedScale,
  type LineSeriesProps,
} from "@crc/viz";
const data = signal<
  readonly { time: number; value: number | null; name: string }[]
>([{ time: 0, value: 1, name: "a" }]);
const props: ScaleProps = {
  id: "x",
  type: "linear",
  domain: signal<readonly [number, number]>([0, 1]),
  range: "width",
  style: signal({ width: 100 }),
};
const line: LineSeriesProps<{
  time: number;
  value: number | null;
  name: string;
}> = {
  data,
  x: "time",
  y: (d) => d.value,
  xScale: "x",
  yScale: "y",
  style: signal({ strokeWidth: signal(2) }),
};
function Probe() {
  const scale: ResolvedScale = useScale("x").get();
  return (
    <Axis
      scale="x"
      position="bottom"
      tickFormat={(value) => String(scale.map(value))}
    />
  );
}
const scene: CRCNode = (
  <Scale {...props}>
    <LineSeries {...line} />
    <ScaleAdjust x={1} xScale="x">
      <Probe />
    </ScaleAdjust>
  </Scale>
);
void scene;
void createElement(
  Scale,
  props,
  createElement(Axis, { scale: "x", position: "left" }),
);
// @ts-expect-error accessors select numeric coordinates
void (<LineSeries data={data} x="name" y="value" xScale="x" yScale="y" />);
// @ts-expect-error no curve catalog in this slice
void (<LineSeries {...line} curve="basis" />);
// Band domains can also contain finite numeric categories.
void (<Scale {...props} type="band" />);
// @ts-expect-error paired coordinate and ID
void (<ScaleAdjust x={1} />);
// @ts-expect-error thunks are not reactive data
void (<LineSeries {...line} data={() => data.get()} />);

import {
  PointSeries,
  PlotSeries,
  nearestPoint,
  nearestDomainValue,
  type PointSeriesProps,
} from "@crc/viz";
const points: PointSeriesProps<{
  time: number;
  value: number | null;
  name: string;
}> = { ...line, style: { radius: signal(3), fill: "red" } };
void (<PointSeries {...points} />);
void createElement(PointSeries, points);
void (
  <PlotSeries
    data={data}
    x="time"
    y="value"
    xScale="x"
    yScale="y"
    keyBy="name"
    render={(d) => <ScaleAdjust x={d.time} xScale="x" />}
  />
);
void createElement(PlotSeries, {
  data,
  x: "time",
  y: "value",
  xScale: "x",
  yScale: "y",
  keyBy: "name",
  render: () => null,
} as const);
// @ts-expect-error coordinates must be numeric
void (<PointSeries data={data} x="name" y="value" xScale="x" yScale="y" />);
// @ts-expect-error callback style returns plain values
void (<PointSeries {...points} style={() => ({ radius: signal(2) })} />);
// @ts-expect-error render is required
void (<PlotSeries data={data} x="time" y="value" xScale="x" yScale="y" />);
void (
  <PlotSeries
    data={data}
    x="time"
    y="value"
    xScale="x"
    yScale="y"
    render={() => null}
    // @ts-expect-error no shared style on custom subtrees
    style={{ fill: "red" }}
  />
);
void (
  <PlotSeries
    data={data}
    x="time"
    y="value"
    xScale="x"
    yScale="y"
    render={() => null}
    // @ts-expect-error no recursive pointer-events switch
    pointerEvents="none"
  />
);
void (
  <PlotSeries
    data={data}
    x="time"
    y="value"
    xScale="x"
    yScale="y"
    // @ts-expect-error async nodes unsupported
    render={async () => null}
  />
);
void nearestPoint;
void nearestDomainValue;

import { HoverData, closestPoint, defineSeries } from "@crc/viz";
const hoverQuery = closestPoint({
  series: {
    a: defineSeries({ data: [{ x: 1, y: 2, label: "a" }], x: "x", y: "y" }),
    b: defineSeries({ data: [{ x: 2, y: 3, count: 4 }], x: "x", y: "y" }),
  },
  position: signal<{ x: number; y: number } | null>(null),
  xScale: "x",
  yScale: "y",
});
const hoverNode = (
  <HoverData query={hoverQuery}>
    {(hit) => {
      if (!hit) return null;
      if (hit.series === "a") {
        const label: string = hit.datum.label;
        void label;
      } else {
        const count: number = hit.datum.count;
        void count;
      }
      return null;
    }}
  </HoverData>
);
const customHover = (
  <HoverData query={() => ({ custom: 1 })}>
    {(value) => {
      const x: number | undefined = value?.custom;
      void x;
      return null;
    }}
  </HoverData>
);
const explicitHover = createElement(
  HoverData<Exclude<ReturnType<typeof hoverQuery>, undefined>>,
  {
    query: hoverQuery,
    children: (value) => {
      void value;
      return null;
    },
  },
);
const asyncHover = (
  // @ts-expect-error Queries must return synchronous values.
  <HoverData query={() => Promise.resolve(1)}>{() => null}</HoverData>
);
void [hoverNode, customHover, explicitHover, asyncHover];

import {
  HoverCard,
  closestX,
  interpolateX,
  linearInterpolation,
  type HoverSample,
  type HoverCardProps,
} from "@crc/viz";
const timeSeries = defineSeries({ data, x: "time", y: "value" });
const nearestTime = closestX({
  series: timeSeries,
  x: signal<number | null>(1),
  xScale: "x",
  yScale: "y",
});
const estimated = interpolateX({
  series: timeSeries,
  x: 1,
  xScale: "x",
  yScale: "y",
  interpolation: linearInterpolation(),
  maxGap: 2,
  duplicateX: "last",
});
const samples = (
  <HoverData query={estimated}>
    {(sample) => {
      if (!sample) return null;
      if (sample.kind === "exact") {
        const name: string = sample.datum.name;
        void name;
      } else {
        const name: string = sample.before.name;
        const next: string = sample.after.name;
        void [name, next];
      }
      return (
        <HoverCard anchor={sample.anchor} style={{ width: 100, height: 30 }} />
      );
    }}
  </HoverData>
);
const cardProps: HoverCardProps = {
  anchor: signal({ x: 10, y: 20 }),
  anchorRadius: signal(5),
  gap: 8,
  bounds: signal({ x: 0, y: 0, width: 100, height: 100 }),
  style: { width: "50%", height: 30, padding: 5, fill: signal("white") },
};
void createElement(HoverCard, cardProps);
const sampleType:
  | HoverSample<{ time: number; value: number | null; name: string }>
  | undefined = undefined;
// @ts-expect-error Custom data callbacks cannot use unsupported data accessors.
void defineSeries({ data, x: "name", y: "value" });
void (
  <HoverCard
    anchor={{ x: 0, y: 0 }}
    // @ts-expect-error Placement excludes arbitrary transforms.
    style={{ width: 100, height: 20, translateX: 1 }}
  />
);
void [nearestTime, samples, sampleType];

import {
  AnchoredLayout,
  type AnchoredItem,
  type AnchoredLayoutProps,
  type AnchoredPlacement,
} from "@crc/viz";
const anchoredItems = [
  { key: "a", anchor: { x: 10, y: 20 }, width: 100, height: 40, label: "A" },
];
const anchoredProps: AnchoredLayoutProps<(typeof anchoredItems)[number]> = {
  items: signal(anchoredItems),
  gap: signal(8),
  direction: "horizontal",
  children: (item, placement) => {
    const name: string = item.label;
    const box: AnchoredPlacement = placement;
    void name;
    void box;
    return null;
  },
};
void createElement(
  AnchoredLayout<(typeof anchoredItems)[number]>,
  anchoredProps,
);
void (
  <AnchoredLayout items={anchoredItems}>
    {(item) => {
      const label: string = item.label;
      // @ts-expect-error Extra item fields retain their original types.
      const bad: number = item.label;
      void label;
      void bad;
      return null;
    }}
  </AnchoredLayout>
);
// @ts-expect-error Declared numeric width is required.
const invalidAnchoredItem: AnchoredItem = {
  key: "a",
  anchor: { x: 0, y: 0 },
  height: 20,
};
void invalidAnchoredItem;

import { BarSeries, type ResolvedBandScale } from "@crc/viz";
void (<BarSeries data={[{ category: "A", value: -2 }]} x="category" y="value" xScale="categories" yScale="values" />);
function BandConsumer() {
  const band: ResolvedBandScale = useScale("categories", "band").get();
  const start: number | undefined = band.map("A");
  void start;
  // @ts-expect-error bands have no numeric inversion
  band.invert(1);
  return null;
}
void BandConsumer;

void (<BarSeries data={[{ category: "A", value: 42 }]} x="category" y="value" xScale="categories" yScale="values" style={{ fill: signal({ type: "threshold" as const, thresholds: [0, 30], colors: ["orange", "green", "red"] }) }} />);
