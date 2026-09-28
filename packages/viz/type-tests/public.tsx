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
