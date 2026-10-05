import {
  HorizontalLine,
  Line,
  Path,
  PathGeometry,
  SvgPath,
  VerticalLine,
  pibbl,
  type HorizontalLineProps,
  type HorizontalLineStyle,
  type LineProps,
  type LineStyle,
  type PathProps,
  type PathStyle,
  type SvgPathProps,
  type SvgPathStyle,
  type VerticalLineProps,
  type VerticalLineStyle,
} from "@pibbl/core";

const lineProps: LineProps = { pointerEvents: "auto" };
const lineStyle: LineStyle = {
  coords: [
    [20, 35],
    [100, 75],
    [180, 30],
  ],
  stroke: "#0f766e",
  strokeWidth: 4,
};
const horizontalProps: HorizontalLineProps = { pointerEvents: "auto" };
const horizontalStyle: HorizontalLineStyle = {
  y: 100,
  x1: 20,
  x2: 300,
  stroke: "#f97316",
  strokeWidth: 3,
};
const verticalProps: VerticalLineProps = { pointerEvents: "auto" };
const verticalStyle: VerticalLineStyle = {
  x: 245,
  y1: 20,
  y2: 185,
  stroke: "#7c3aed",
  strokeWidth: 3,
};
const heart = new PathGeometry();
heart.moveTo(80, 150);
heart.bezierCurveTo(45, 115, 20, 165, 80, 200);
heart.bezierCurveTo(140, 165, 115, 115, 80, 150);
heart.closePath();
const pathProps: PathProps = { pointerEvents: "auto" };
const pathStyle: PathStyle = { d: heart, fill: "#e11d48" };
const svgProps: SvgPathProps = { pointerEvents: "auto" };
const svgStyle: SvgPathStyle = {
  d: "M145 155 Q180 120 215 155 Q180 190 145 155 Z",
  fill: "#facc15",
  stroke: "#854d0e",
  strokeWidth: 2,
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <>
    <Line {...lineProps} style={lineStyle} />
    <HorizontalLine {...horizontalProps} style={horizontalStyle} />
    <VerticalLine {...verticalProps} style={verticalStyle} />
    <Path {...pathProps} style={pathStyle} />
    <SvgPath {...svgProps} style={svgStyle} />
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
