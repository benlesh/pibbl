import {
  Polygon,
  RegularPolygon,
  Star,
  crc,
  type PolygonProps,
  type PolygonStyle,
  type RegularPolygonProps,
  type RegularPolygonStyle,
  type StarProps,
  type StarStyle,
} from "@crc/core";

const triangleProps: PolygonProps = { pointerEvents: "auto" };
const triangleStyle: PolygonStyle = {
  coords: [
    [30, 170],
    [80, 35],
    [130, 170],
  ],
  cornerRadius: 7,
  fill: "#0f766e",
};
const hexProps: RegularPolygonProps = { pointerEvents: "auto" };
const hexStyle: RegularPolygonStyle = {
  sides: 6,
  cx: 185,
  cy: 105,
  circumradius: 60,
  fill: "#f97316",
  stroke: "#9a3412",
  strokeWidth: 2,
};
const starProps: StarProps = { pointerEvents: "auto" };
const starStyle: StarStyle = {
  points: 5,
  cx: 280,
  cy: 105,
  outerRadius: 34,
  innerRadius: 17,
  fill: "#7c3aed",
};
const canvas = document.createElement("canvas");
canvas.width = 340;
canvas.height = 220;
document.body.append(canvas);
const app = crc(
  canvas,
  <>
    <Polygon {...triangleProps} style={triangleStyle} />
    <RegularPolygon {...hexProps} style={hexStyle} />
    <Star {...starProps} style={starStyle} />
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
