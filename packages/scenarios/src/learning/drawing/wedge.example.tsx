import { crc, crcState, Rectangle, Wedge, type CRCController } from "@crc/core";

function WedgeStudy() {
  const [active, setActive] = crcState(false);

  return [
    <Rectangle
      style={{ x: 0, y: 0, width: 720, height: 420, fill: "#f7f0df" }}
    />,
    <Wedge
      style={{
        cx: 360,
        cy: 210,
        radius: 132,
        startAngle: -Math.PI / 2,
        endAngle: Math.PI / 3,
        fill: active ? "#22c55e" : "#a855f7",
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "pointer",
      }}
      onClick={() => setActive((value) => !value)}
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <WedgeStudy />);
}
