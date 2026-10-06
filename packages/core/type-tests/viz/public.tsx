import { createElement, signal, type PibblNode } from "@pibbl/core";
import { Axis, LineSeries, ScaleAdjust, type LinearScaleProps, type ResolvedScale, type LineSeriesProps, useLinearScale, BarScale, useBarScale, LinearScale, useUTCScale, UTCScale } from "@pibbl/core/viz";
const data = signal<
  readonly { time: number; value: number | null; name: string }[]
>([{ time: 0, value: 1, name: "a" }]);
const props: LinearScaleProps = {
  id: "x",
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
  const scale: ResolvedScale = useLinearScale("x").get();
  return (
    <Axis
      scale="x"
      position="bottom"
      tickFormat={(value) => typeof value === "number" ? String(scale.map(value)) : value}
    />
  );
}
const scene: PibblNode = (
  <LinearScale {...props}>
    <LineSeries {...line} />
    <ScaleAdjust x={1} xScale="x">
      <Probe />
    </ScaleAdjust>
  </LinearScale>
);
void scene;
void createElement(
  LinearScale,
  props,
  createElement(Axis, { scale: "x", position: "left" }),
);
// @ts-expect-error accessors select numeric coordinates
void (<LineSeries data={data} x="name" y="value" xScale="x" yScale="y" />);
// @ts-expect-error no curve catalog in this slice
void (<LineSeries {...line} curve="basis" />);
// Band domains can also contain finite numeric categories.
void (<BarScale {...props}  />);
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
} from "@pibbl/core/viz";
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

import { HoverData, closestPoint, defineSeries } from "@pibbl/core/viz";
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
} from "@pibbl/core/viz";
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
} from "@pibbl/core/viz";
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

import { BarSeries, type ResolvedBandScale } from "@pibbl/core/viz";
void (
  <BarSeries
    data={[{ category: "A", value: -2 }]}
    category="category"
    value="value"
    categoryScale="categories"
    valueScale="values"
  />
);
function BandConsumer() {
  const band: ResolvedBandScale = useBarScale("categories").get();
  const start: number | undefined = band.map("A");
  void start;
  // @ts-expect-error bands have no numeric inversion
  band.invert(1);
  return null;
}
void BandConsumer;

void (
  <BarSeries
    data={[{ category: "A", value: 42 }]}
    category="category"
    value="value"
    categoryScale="categories"
    valueScale="values"
    style={{
      fill: signal({
        type: "threshold" as const,
        thresholds: [0, 30],
        colors: ["orange", "green", "red"],
      }),
    }}
  />
);

import type {
  BandScaleRange,
  BarStyleResolver,
  BarSeriesProps,
} from "@pibbl/core/viz";
const groupedRows = [{ category: "A", group: "East", value: 12 }];
const nestedRange: BandScaleRange = { bandwidthOf: Symbol("category") };
const groupStyle: BarStyleResolver<(typeof groupedRows)[number]> = (row) => ({
  fill: row.group === "East" ? "teal" : "orange",
});
void (
  <BarScale id="g"  domain={["East"]} range={signal(nestedRange)} />
);
void (
  <BarSeries
    data={groupedRows}
    category="category"
    value="value"
    group="group"
    groupScale="g"
    categoryScale="c"
    valueScale="v"
    style={groupStyle}
  />
);
// @ts-expect-error group requires groupScale
const incompleteGroup: BarSeriesProps<(typeof groupedRows)[number]> = {
  data: groupedRows,
  category: "category",
  value: "value",
  group: "group",
  categoryScale: "c",
  valueScale: "v",
};
void incompleteGroup;
void (
  (
    // @ts-expect-error numeric scales cannot use bandwidthOf
    <LinearScale id="v"  domain={[0, 1]} range={{ bandwidthOf: "c" }} />
  )
);
const signalGroupStyle: BarStyleResolver<
  (typeof groupedRows)[number]
> = () => ({
  // @ts-expect-error datum style callbacks return plain values
  opacity: signal(0.5),
});
void signalGroupStyle;

const stackRows = [{ category: "Q1", group: "Actual", from: -5, to: -9 }];
void (
  <BarSeries
    data={stackRows}
    category="category"
    valueStart="from"
    valueEnd="to"
    categoryScale="c"
    valueScale="v"
    group="group"
    groupScale="g"
    style={{ fill: "orange" }}
  />
);
// @ts-expect-error range endpoints must be paired
const missingRangeEnd: BarSeriesProps<(typeof stackRows)[number]> = {
  data: stackRows,
  category: "category",
  valueStart: "from",
  categoryScale: "c",
  valueScale: "v",
};
const mixedInput = {
  data: stackRows,
  category: "category",
  value: "to",
  valueStart: "from",
  valueEnd: "to",
  categoryScale: "c",
  valueScale: "v",
} as const;
// @ts-expect-error value and range geometry cannot be mixed
const mixedGeometry: BarSeriesProps<(typeof stackRows)[number]> = mixedInput;
// @ts-expect-error explicit ranges cannot also use a shared baseline
const rangeBaseline: BarSeriesProps<(typeof stackRows)[number]> = {
  data: stackRows,
  category: "category",
  valueStart: "from",
  valueEnd: "to",
  baseline: 0,
  categoryScale: "c",
  valueScale: "v",
};
void missingRangeEnd;
void mixedGeometry;
void rangeBaseline;

import { PieLayout, PieSlice, PieLabel, pieSlices, type PieSliceGeometry } from "@pibbl/core/viz";
const pieData = [{ id: "a", amount: 2, name: "Alpha" }];
const pieLabel = (slice: PieSliceGeometry<typeof pieData[number]>) => slice.datum.name;
const pieGeometry = pieSlices(pieData, { value: "amount", keyBy: "id" });
void pieGeometry;
const pie = <PieLayout data={pieData} value="amount" keyBy="id" label={pieLabel} placement="auto">
  {slice => <PieSlice slice={slice} style={{ fill: "red" }}><PieLabel slice={slice} pointerEvents="auto" onClick={() => {}} /></PieSlice>}
</PieLayout>;
void pie;

// Approved categorical and explicit Axis tick contract.
void (<Axis scale="category" position="right" tickValues={signal<readonly (number | string)[]>(["A", 2])} tickFormat={(value, index) => `${index}: ${value}`} />);
void (<Axis scale="value" position="top" tickCount={0} />);
// @ts-expect-error explicit ticks and count are mutually exclusive
void (<Axis scale="value" position="bottom" tickValues={[1, 2]} tickCount={2} />);
// @ts-expect-error explicit ticks accept numbers or strings, not Date objects
void (<Axis scale="value" position="bottom" tickValues={[new Date()]} />);

void (<BarSeries data={[{ name: "A", total: 2 }]} orientation="horizontal" category="name" value="total" categoryScale="c" valueScale="v" />);
// @ts-expect-error old coordinate props were removed, without compatibility aliases
void (<BarSeries data={[{ category: "A", value: 2 }]} x="category" y="value" xScale="c" yScale="v" />);
void (<PieLayout data={pieData} value="amount" revision={signal(0)} style={{ radius: 100, innerRadius: signal(55) }}>{slice => { const hole: number = slice.innerRadius; void hole; return <PieSlice slice={slice} />; }}</PieLayout>);
// @ts-expect-error cache revisions are numeric
void (<PieLayout data={pieData} value="amount" revision="stale">{() => null}</PieLayout>);

import { extent, niceUTCDomain, type UTCScaleProps, type ResolvedUtcScale, type ResolvedContinuousScale } from "@pibbl/core/viz";
const utcDomain = niceUTCDomain(extent([0, 86400000], value => value)!);
const utcProps: UTCScaleProps = { id: "utc", domain: utcDomain, range: "width" };
function UtcProbe() {
  const utc: ResolvedUtcScale = useUTCScale("utc").get();
  const continuous: ResolvedContinuousScale = useUTCScale("utc").get();
  return <Axis scale="utc" position="bottom" tickFormat={() => utc.formatTick(continuous.invert(0))} />;
}
void <UTCScale {...utcProps}><UtcProbe /></UTCScale>;

// Scale families are explicit in both providers and hooks.
// @ts-expect-error a family selector is not a supported hook argument
void useLinearScale("x", "utc");
// @ts-expect-error UTC formatting is not part of a linear scale
void useLinearScale("x").get().formatTick(0);
// @ts-expect-error bands have no numeric inverse
void useBarScale("category").get().invert(0);
// @ts-expect-error providers do not accept a type selector
void <LinearScale {...props} type="utc" />;

// Every logarithmic caller receives one fixed mapping type, with no family selector.
import { LogScale, useLogScale, type ResolvedLogScale, type LogScaleProps } from "@pibbl/core/viz";
function LogProbe() {
  const log: import("@pibbl/core").Signal<ResolvedLogScale> = useLogScale("log");
  const value: number = log.get().invert(50);
  void value;
  // @ts-expect-error the dedicated hook accepts only an ID
  useLogScale("log", "linear");
}
const logProps: LogScaleProps = { id: "log", domain: signal<readonly [number, number]>([1, 1000]), range: "width", base: signal(10) };
void (<LogScale {...logProps}><LogProbe /><Axis scale="log" position="bottom" /></LogScale>);
