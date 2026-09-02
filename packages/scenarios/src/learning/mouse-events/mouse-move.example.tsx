import { crc, crcState, Rectangle, Text, type CRCController } from "@crc/core";
function MouseMoveStudy() {
  const [trail, setTrail] = crcState<readonly [number, number][]>([]);
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#f7f0df",
      }}
    />,
    <Rectangle
      style={{
        x: 58,
        y: 72,
        width: 604,
        height: 276,
        fill: "#1f4bd8",
        cursor: "crosshair",
      }}
      onMouseMove={(event) =>
        setTrail((points) => [...points.slice(-17), [event.x, event.y]])
      }
    />,
    ...trail.map(([x, y], index) => (
      <Rectangle
        style={{
          x: x - 5,
          y: y - 5,
          width: 10,
          height: 10,
          fill: index === trail.length - 1 ? "#f7c948" : "#74d3ae",
          opacity: (index + 3) / (trail.length + 2),
        }}
      />
    )),
    <Text
      style={{
        x: 360,
        y: 368,
        fill: "#17211d",
        font: "800 15px monospace",
        textAlign: "center",
      }}
    >
      {trail.length
        ? `${Math.round(trail.at(-1)![0])}, ${Math.round(trail.at(-1)![1])}`
        : "MOVE INSIDE THE FIELD"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <MouseMoveStudy />);
}
