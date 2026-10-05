import { pibbl } from "@pibbl/core";
import {
  Axis,
  LineSeries,
  Scale,
  ScaleAdjust,
  type LineAccessor,
  type LineCoordinate,
  type LineCurve,
  type LineSeriesProps,
  type LineSeriesStyle,
  type ScaleAdjustProps,
} from "@pibbl/core/viz";

type Reading = { day: number; value: number | null };
const data: readonly Reading[] = [
  { day: 1, value: 18 },
  { day: 2, value: 32 },
  { day: 3, value: null },
  { day: 4, value: 27 },
];
const x: LineAccessor<Reading> = "day";
const y: LineAccessor<Reading> = (datum): LineCoordinate => datum.value;
const curve: LineCurve = "linear";
const style: LineSeriesStyle = { stroke: "#0f766e", strokeWidth: 3 };
const line: LineSeriesProps<Reading> = {
  data,
  x,
  y,
  xScale: "day",
  yScale: "value",
  curve,
  style,
};
const marker: ScaleAdjustProps = {
  x: 2,
  xScale: "day",
  children: <Axis scale="value" position="right" />,
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <Scale
    id="day"
    type="linear"
    domain={[1, 4]}
    range="width"
    style={{ width: 320, height: 220 }}
  >
    <Scale id="value" type="linear" domain={[0, 40]} range="height" reverse>
      <LineSeries {...line} />
      <ScaleAdjust {...marker} />
    </Scale>
  </Scale>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
