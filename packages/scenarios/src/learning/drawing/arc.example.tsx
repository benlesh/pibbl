import { Arc, crc, useState, Rectangle, type CRCController } from "@crc/core";

function ArcStudy() {
  const [active, setActive] = useState(false);

  return [
    <Rectangle
      style={{ x: 0, y: 0, width: 720, height: 420, fill: "#f7f0df" }}
    />,
    <Arc
      style={{
        cx: 360,
        cy: 210,
        radius: 120,
        startAngle: -Math.PI,
        endAngle: 0,
        stroke: active ? "#ff6b57" : "#1f4bd8",
        strokeWidth: 14,
        lineInteractionWidth: 34,
        cursor: "pointer",
      }}
      onClick={() => setActive((value) => !value)}
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <ArcStudy />);
}
