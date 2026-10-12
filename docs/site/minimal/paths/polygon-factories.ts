import {
  createPolygonPath,
  createRectanglePath,
  createRegularPolygonPath,
  createStarPath,
  type PolygonPathOptions,
  type RectanglePathOptions,
  type RegularPolygonNumericSize,
  type RegularPolygonPathOptions,
  type RegularPolygonPathPosition,
  type RoundedCornerPathOptions,
  type StarPathOptions,
} from "@pibbl/core";

const corners: RoundedCornerPathOptions = { cornerRadius: 6 };
const rectangle: RectanglePathOptions = {
  x: 12,
  y: 12,
  width: 100,
  height: 70,
  ...corners,
};
const polygon: PolygonPathOptions = {
  coords: [
    [130, 20],
    [190, 70],
    [130, 90],
  ],
  ...corners,
};
const position: RegularPolygonPathPosition = { sides: 6, cx: 70, cy: 150 };
const size: RegularPolygonNumericSize = { circumradius: 36 };
const hexagon: RegularPolygonPathOptions = { ...position, ...size, ...corners };
const star: StarPathOptions = {
  points: 5,
  cx: 160,
  cy: 150,
  innerRadius: 17,
  outerRadius: 38,
};
const paths: Path2D[] = [
  createRectanglePath(rectangle),
  createPolygonPath(polygon),
  createRegularPolygonPath(hexagon),
  createStarPath(star),
];
const canvas = document.createElement("canvas");
canvas.width = 220;
canvas.height = 220;
document.body.append(canvas);
const context = canvas.getContext("2d")!;
context.lineWidth = 3;
paths.forEach((path, index) => {
  context.strokeStyle = ["#0f766e", "#f97316", "#7c3aed", "#e11d48"][index];
  context.stroke(path);
});
