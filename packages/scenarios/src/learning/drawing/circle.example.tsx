import { Circle, crc, useState, Rectangle, type CRCController } from "@crc/core";

function CircleStudy() {
  const [active, setActive] = useState(false);

  return [
    <Rectangle
      style={{ x: 0, y: 0, width: 720, height: 420, fill: "#f7f0df" }}
    />,
    <Circle
      style={{
        cx: 360,
        cy: 210,
        radius: 110,
        fill: active ? "#74d3ae" : "#ff6b57",
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "pointer",
      }}
      onClick={() => setActive((value) => !value)}
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <CircleStudy />);
}
