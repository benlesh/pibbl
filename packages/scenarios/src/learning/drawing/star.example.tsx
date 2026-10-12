import { pibbl, Rectangle, Star, type PibblController } from "@pibbl/core";

function StarStudy() {
  return [
    <Rectangle
      style={{ left: 0, top: 0, width: 720, height: 420, fill: "#17211d" }}
    />,
    <Star
      style={{
        points: 5,
        cx: 230,
        cy: 210,
        outerRadius: 148,
        innerRadius: 66,
        fill: "#f7c948",
        stroke: "#f7f0df",
        strokeWidth: 5,
      }}
    />,
    <Star
      style={{
        points: 7,
        cx: 500,
        cy: 210,
        outerRadius: 132,
        innerRadius: 58,
        rotation: Math.PI / 7,
        cornerRadii: [18, 0, 18, 0, 18, 0, 18, 0, 18, 0, 18, 0, 18, 0],
        fill: "#ff6b57",
        stroke: "#f7f0df",
        strokeWidth: 5,
      }}
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <StarStudy />);
}
