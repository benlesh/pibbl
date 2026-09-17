import { crc, useState, Ellipse, Rectangle, type CRCController } from "@crc/core";

function EllipseStudy() {
  const [active, setActive] = useState(false);

  return [
    <Rectangle
      style={{ x: 0, y: 0, width: 720, height: 420, fill: "#f7f0df" }}
    />,
    <Ellipse
      style={{
        cx: 360,
        cy: 210,
        radiusX: 154,
        radiusY: 78,
        rotation: -0.22,
        fill: active ? "#f7c948" : "#1f4bd8",
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "pointer",
      }}
      onClick={() => setActive((value) => !value)}
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <EllipseStudy />);
}
