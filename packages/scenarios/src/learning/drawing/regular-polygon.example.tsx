import {
  crc,
  Rectangle,
  RegularPolygon,
  type CRCController,
} from "@crc/core";

function RegularPolygonStudy() {
  return [
    <Rectangle
      style={{ left: 0, top: 0, width: 720, height: 420, fill: "#f7f0df" }}
    />,
    <RegularPolygon
      style={{
        sides: 5,
        cx: 150,
        cy: 210,
        circumradius: 112,
        fill: "#1f4bd8",
        stroke: "#17211d",
        strokeWidth: 5,
      }}
    />,
    <RegularPolygon
      style={{
        sides: 6,
        cx: 360,
        cy: 210,
        inradius: 96,
        rotation: Math.PI / 6,
        fill: "#f7c948",
        stroke: "#17211d",
        strokeWidth: 5,
      }}
    />,
    <RegularPolygon
      style={{
        sides: 4,
        cx: 570,
        cy: 210,
        sideLength: 138,
        rotation: Math.PI / 4,
        fill: "#74d3ae",
        stroke: "#17211d",
        strokeWidth: 5,
      }}
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <RegularPolygonStudy />);
}
