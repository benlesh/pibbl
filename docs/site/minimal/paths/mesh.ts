import {
  PathGeometry,
  meshTransform,
  toPath2D,
  transformPath,
  type MeshTransformOptions,
  type PathGuide,
} from "@crc/core";

function edge(x1: number, y1: number, x2: number, y2: number): PathGuide {
  const path = new PathGeometry();
  path.moveTo(x1, y1);
  path.lineTo(x2, y2);
  return path;
}
const options: MeshTransformOptions = {
  source: { x: 0, y: 0, width: 100, height: 100 },
  columns: [0, 1],
  rows: [0, 1],
  horizontal: [[edge(0, 0, 100, 0)], [edge(0, 100, 100, 100)]],
  vertical: [[edge(0, 0, 0, 100)], [edge(100, 0, 100, 100)]],
};
const shape = new PathGeometry();
shape.ellipse(50, 50, 35, 35, 0, 0, Math.PI * 2);
const warped = transformPath(shape, meshTransform(options), { tolerance: 0.5 });
const canvas = document.createElement("canvas");
canvas.width = 240;
canvas.height = 120;
document.body.append(canvas);
const context = canvas.getContext("2d")!;
context.translate(10, 10);
context.lineWidth = 3;
context.strokeStyle = "#94a3b8";
context.stroke(toPath2D(shape));
context.translate(120, 0);
context.strokeStyle = "#0f766e";
context.stroke(toPath2D(warped));
