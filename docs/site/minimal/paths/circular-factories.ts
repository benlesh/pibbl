import {
  createArcPath,
  createCirclePath,
  createEllipsePath,
  createWedgePath,
  type ArcPathOptions,
  type CirclePathOptions,
  type EllipsePathOptions,
  type WedgePathOptions,
} from "@pibbl/core";

const circleOptions: CirclePathOptions = { cx: 70, cy: 70, radius: 32 };
const ellipseOptions: EllipsePathOptions = {
  cx: 160,
  cy: 70,
  radiusX: 48,
  radiusY: 24,
};
const arcOptions: ArcPathOptions = {
  cx: 70,
  cy: 160,
  radius: 36,
  startAngle: 0,
  endAngle: Math.PI * 1.5,
};
const wedgeOptions: WedgePathOptions = {
  ...arcOptions,
  cx: 160,
  cy: 160,
};
const paths: Path2D[] = [
  createCirclePath(circleOptions),
  createEllipsePath(ellipseOptions),
  createArcPath(arcOptions),
  createWedgePath(wedgeOptions),
];
const canvas = document.createElement("canvas");
canvas.width = 240;
canvas.height = 220;
document.body.append(canvas);
const context = canvas.getContext("2d")!;
context.lineWidth = 3;
paths.forEach((path, index) => {
  context.strokeStyle = ["#0f766e", "#f97316", "#7c3aed", "#e11d48"][index];
  context.stroke(path);
});
