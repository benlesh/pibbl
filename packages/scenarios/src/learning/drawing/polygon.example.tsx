import { crc, useSignal, Polygon, Rectangle, type CRCController } from "@crc/core";

function PolygonStudy() {
  const active = useSignal(false);

  return [
    <Rectangle
      style={{ left: 0, top: 0, width: 720, height: 420, fill: "#f7f0df" }}
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
        fill: active.get() ? "#14b8a6" : "#f59e0b",
        stroke: "#17211d",
        strokeWidth: 6,
        cornerRadius: 18,
        cursor: "pointer",
      }}
      onClick={() => active.update((value) => !value)}
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PolygonStudy />);
}
