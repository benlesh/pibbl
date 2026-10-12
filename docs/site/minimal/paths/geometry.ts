import {
  PathGeometry,
  flattenPath,
  flattenPathWang,
  simplifyPath,
  simplifyPathRadial,
  subdividePath,
  toPath2D,
  toSvgPathData,
  type FlattenPathOptions,
  type PathSegment,
  type SimplifyPathOptions,
  type SubdividePathOptions,
} from "@pibbl/core";

const curve = new PathGeometry();
curve.moveTo(10, 70);
curve.bezierCurveTo(40, 10, 80, 10, 110, 70);
const closing: PathSegment = { type: "line", x: 10, y: 70 };
curve.spliceSegments(curve.segmentCount, 0, [closing, { type: "close" }]);
const flatOptions: FlattenPathOptions = { tolerance: 0.5 };
const simpleOptions: SimplifyPathOptions = { tolerance: 1 };
const divideOptions: SubdividePathOptions = { divisions: 3 };
const flattened = flattenPath(curve, flatOptions);
const adaptive = flattenPathWang(curve, flatOptions);
const subdivided = subdividePath(curve, divideOptions);
const simplified = simplifyPath(flattened, simpleOptions);
const radial = simplifyPathRadial(flattened, simpleOptions);
const canvas = document.createElement("canvas");
canvas.width = 260;
canvas.height = 180;
canvas.title = toSvgPathData(curve);
document.body.append(canvas);
const context = canvas.getContext("2d")!;
context.translate(15, 20);
const canvasPath: Path2D = toPath2D(curve);
context.lineWidth = 3;
context.strokeStyle = "#0f766e";
context.stroke(canvasPath);
for (const [index, path] of [
  adaptive,
  subdivided,
  simplified,
  radial,
].entries()) {
  context.save();
  context.translate(125, index * 38);
  context.scale(0.45, 0.45);
  context.strokeStyle = ["#f97316", "#7c3aed", "#e11d48", "#0f766e"][index];
  context.stroke(toPath2D(path));
  context.restore();
}
