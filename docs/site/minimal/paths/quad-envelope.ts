import {
  PathGeometry,
  envelopeTransform,
  quadTransform,
  toPath2D,
  transformPath,
  type EnvelopeGuide,
  type EnvelopeTransformOptions,
  type PathGuide,
  type PathGuideOptions,
  type PathGuideStation,
  type PathQuadCorners,
  type PathQuadMode,
  type QuadTransformOptions,
} from "@pibbl/core";

const tile = new PathGeometry();
tile.rect(0, 0, 100, 60);
const corners: PathQuadCorners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 115, y: 15 },
  bottomLeft: { x: 10, y: 70 },
  bottomRight: { x: 100, y: 55 },
};
const mode: PathQuadMode = "bilinear";
const quadOptions: QuadTransformOptions = {
  source: { x: 0, y: 0, width: 100, height: 60 },
  destination: corners,
  mode,
};
const warped = transformPath(tile, quadTransform(quadOptions), {
  tolerance: 0.5,
});
const top = new PathGeometry();
top.moveTo(0, 0);
top.lineTo(100, 15);
const bottom = new PathGeometry();
bottom.moveTo(0, 60);
bottom.lineTo(100, 75);
const stations: PathGuideStation[] = [
  { at: 0, distance: 0 },
  { at: 1, distance: 1 },
];
const guideOptions: PathGuideOptions = { path: top, stations };
const topGuide: PathGuide = guideOptions;
const guides: EnvelopeGuide[] = [
  { at: 0, path: topGuide },
  { at: 1, path: bottom },
];
const envelopeOptions: EnvelopeTransformOptions = {
  source: quadOptions.source,
  guides,
};
const wrapped = transformPath(tile, envelopeTransform(envelopeOptions), {
  tolerance: 0.5,
});
const canvas = document.createElement("canvas");
canvas.width = 270;
canvas.height = 110;
document.body.append(canvas);
const context = canvas.getContext("2d")!;
context.translate(8, 12);
context.lineWidth = 3;
context.strokeStyle = "#94a3b8";
context.stroke(toPath2D(tile));
context.strokeStyle = "#0f766e";
context.stroke(toPath2D(warped));
context.translate(135, 0);
context.strokeStyle = "#f97316";
context.stroke(toPath2D(wrapped));
