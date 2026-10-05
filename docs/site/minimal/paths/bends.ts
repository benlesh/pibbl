import {
  PathGeometry,
  arcBendTransform,
  pathBendTransform,
  toPath2D,
  transformPath,
  type ArcBendTransformOptions,
  type BendTransformOptions,
  type PathBendAlign,
  type PathBendArc,
  type PathBendBaseline,
  type PathBendFit,
  type PathBendOverflow,
  type PathBendTransformOptions,
} from "@pibbl/core";

const letters = new PathGeometry();
letters.rect(0, 0, 80, 20);
const guide = new PathGeometry();
guide.moveTo(0, 100);
guide.quadraticCurveTo(60, 15, 120, 100);
const align: PathBendAlign = "center";
const baseline: PathBendBaseline = "bottom";
const fit: PathBendFit = "stretch";
const overflow: PathBendOverflow = "extend";
const base: BendTransformOptions = {
  source: { x: 0, y: 0, width: 80, height: 20 },
  align,
  baseline,
  fit,
  overflow,
};
const arc: PathBendArc = {
  cx: 60,
  cy: 100,
  radius: 70,
  startAngle: Math.PI,
  sweep: Math.PI,
};
const arcOptions: ArcBendTransformOptions = { ...base, arc };
const pathOptions: PathBendTransformOptions = { ...base, guide };
const aroundArc = transformPath(letters, arcBendTransform(arcOptions), {
  tolerance: 0.5,
});
const alongGuide = transformPath(letters, pathBendTransform(pathOptions), {
  tolerance: 0.5,
});
const canvas = document.createElement("canvas");
canvas.width = 370;
canvas.height = 230;
document.body.append(canvas);
const context = canvas.getContext("2d")!;
context.translate(55, 10);
context.lineWidth = 3;
context.strokeStyle = "#94a3b8";
context.stroke(toPath2D(letters));
context.strokeStyle = "#0f766e";
context.stroke(toPath2D(aroundArc));
context.translate(160, 0);
context.strokeStyle = "#f97316";
context.stroke(toPath2D(alongGuide));
