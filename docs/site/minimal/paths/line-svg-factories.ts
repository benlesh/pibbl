import {
  createLinePath,
  createSvgPath,
  type LinePathOptions,
  type SvgPathOptions,
} from "@crc/core";

const lineOptions: LinePathOptions = {
  coords: [
    [10, 20],
    [80, 50],
    [150, 15],
  ],
};
const svgOptions: SvgPathOptions = { d: "M10 90 Q80 20 150 90" };
const handDrawn = createLinePath(lineOptions);
const authored = createSvgPath(svgOptions);
const canvas = document.createElement("canvas");
canvas.width = 170;
canvas.height = 120;
document.body.append(canvas);
const context = canvas.getContext("2d")!;
context.lineWidth = 4;
context.strokeStyle = "#0f766e";
context.stroke(handDrawn);
context.strokeStyle = "#f97316";
context.stroke(authored);
