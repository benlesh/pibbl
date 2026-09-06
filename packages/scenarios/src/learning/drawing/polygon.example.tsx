import { crc, crcState, Polygon, Rectangle, type CRCController } from "@crc/core";

function PolygonStudy() {
  const [active, setActive] = crcState(false);

  return [
    <Rectangle
      style={{ x: 0, y: 0, width: 720, height: 420, fill: "#f7f0df" }}
    />,
    <Polygon
      style={{
        coords: [
          [360, 72],
          [500, 174],
          [446, 338],
          [274, 338],
          [220, 174],
        ],
        fill: active ? "#14b8a6" : "#f59e0b",
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "pointer",
      }}
      onClick={() => setActive((value) => !value)}
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PolygonStudy />);
}
