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
// @ts-expect-error no band scale in this slice
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
