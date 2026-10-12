import {
  PathGeometry,
  affineTransform,
  composeTransforms,
  toPath2D,
  transformPath,
  type PathPoint,
  type PathRect,
  type PathTransform,
  type TransformPathOptions,
} from "@pibbl/core";

const source: PathRect = { x: 0, y: 0, width: 100, height: 80 };
const shape = new PathGeometry();
shape.rect(source.x, source.y, source.width, source.height);
const translate: PathTransform = affineTransform({ e: 40, f: 20 });
const enlarge: PathTransform = affineTransform({ a: 1.5, d: 1.5 });
const combined = composeTransforms(translate, enlarge);
const options: TransformPathOptions = { tolerance: 0.5 };
const transformed = transformPath(shape, combined, options);
const center: PathPoint = combined.mapPoint({ x: 50, y: 40 });
const canvas = document.createElement("canvas");
canvas.width = 260;
canvas.height = 180;
document.body.append(canvas);
const context = canvas.getContext("2d")!;
context.translate(12, 12);
context.lineWidth = 3;
context.strokeStyle = "#94a3b8";
context.stroke(toPath2D(shape));
context.strokeStyle = "#0f766e";
context.stroke(toPath2D(transformed));
context.beginPath();
context.arc(center.x, center.y, 5, 0, Math.PI * 2);
context.fillStyle = "#f97316";
context.fill();
