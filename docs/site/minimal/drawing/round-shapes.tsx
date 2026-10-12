import {
  Arc,
  Circle,
  Ellipse,
  Rectangle,
  Wedge,
  pibbl,
  type ArcProps,
  type ArcStyle,
  type CircleProps,
  type CircleStyle,
  type EllipseProps,
  type EllipseStyle,
  type CursorStyle,
  type FillStyle,
  type PaintStyle,
  type RectangleProps,
  type RectStyle,
  type RoundedCornerStyle,
  type StrokeStyle,
  type WedgeProps,
  type WedgeStyle,
} from "@pibbl/core";

const fill: FillStyle = "#0f766e";
const stroke: StrokeStyle = "#134e4a";
const paint: PaintStyle = { fill, stroke, strokeWidth: 2 };
const cursor: CursorStyle = { cursor: "pointer" };
const corners: RoundedCornerStyle = { cornerRadius: 8 };
const circleProps: CircleProps = { pointerEvents: "auto" };
const circleStyle: CircleStyle = {
  cx: 70,
  cy: 75,
  radius: 35,
  ...paint,
  ...cursor,
};
const ellipseProps: EllipseProps = { pointerEvents: "auto" };
const ellipseStyle: EllipseStyle = {
  cx: 170,
  cy: 75,
  radiusX: 50,
  radiusY: 24,
  fill: "#f97316",
};
const rectProps: RectangleProps = { pointerEvents: "auto" };
const rectStyle: RectStyle = {
  left: 15,
  top: 135,
  width: 90,
  height: 55,
  ...corners,
  fill: "#e11d48",
};
const arcProps: ArcProps = { pointerEvents: "auto" };
const arcStyle: ArcStyle = {
  cx: 160,
  cy: 155,
  radius: 35,
  startAngle: Math.PI,
  endAngle: Math.PI * 2,
  stroke: "#0f766e",
  strokeWidth: 6,
};
const wedgeProps: WedgeProps = { pointerEvents: "auto" };
const wedgeStyle: WedgeStyle = {
  cx: 270,
  cy: 155,
  radius: 38,
  startAngle: 0,
  endAngle: Math.PI * 1.3,
  fill: "#7c3aed",
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <>
    <Circle {...circleProps} style={circleStyle} />
    <Ellipse {...ellipseProps} style={ellipseStyle} />
    <Rectangle {...rectProps} style={rectStyle} />
    <Arc {...arcProps} style={arcStyle} />
    <Wedge {...wedgeProps} style={wedgeStyle} />
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
