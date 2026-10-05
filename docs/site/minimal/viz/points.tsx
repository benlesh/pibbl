import { pibbl, Circle } from "@pibbl/core";
import {
  PlotSeries,
  PointSeries,
  Scale,
  ScaleAdjust,
  type PlotKeyAccessor,
  type PlotSeriesProps,
  type PointAccessor,
  type PointMarkStyle,
  type PointSeriesProps,
  type PointSeriesStyle,
  type PointStyleResolver,
} from "@pibbl/core/viz";

type Datum = { id: string; x: number; y: number; important: boolean };
const data: readonly Datum[] = [
  { id: "a", x: 1, y: 3, important: true },
  { id: "b", x: 2, y: 2, important: false },
];
const x: PointAccessor<Datum> = "x";
const mark: PointMarkStyle = { radius: 6, fill: "#ef4444" };
const style: PointStyleResolver<Datum> = (datum): PointSeriesStyle =>
  datum.important ? mark : { radius: 4, fill: "#0f766e" };
const points: PointSeriesProps<Datum> = {
  data,
  x,
  y: "y",
  xScale: "x",
  yScale: "y",
  style,
};
const keyBy: PlotKeyAccessor<Datum> = "id";
const plot: PlotSeriesProps<Datum> = {
  data,
  x,
  y: "y",
  xScale: "x",
  yScale: "y",
  keyBy,
  render: (datum) => (
    <ScaleAdjust x={datum.x} xScale="x" y={datum.y} yScale="y">
      <Circle style={{ radius: datum.important ? 2 : 1, fill: "#111827" }} />
    </ScaleAdjust>
  ),
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <Scale
    id="x"
    type="linear"
    domain={[0, 3]}
    range="width"
    style={{ width: 320, height: 220 }}
  >
    <Scale id="y" type="linear" domain={[0, 4]} range="height" reverse>
      <PointSeries {...points} />
      <PlotSeries {...plot} />
    </Scale>
  </Scale>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
