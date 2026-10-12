import { pibbl, useSignal, Rectangle, Text, type PibblController } from "@pibbl/core";
function MouseMoveStudy() {
  const trail = useSignal<readonly [number, number][]>([]);
  return [
    <Rectangle
      style={{
        left: 0,
        top: 0,
        width: 720,
        height: 420,
        fill: "#f7f0df",
      }}
    />,
    <Rectangle
      style={{
        left: 58,
        top: 72,
        width: 604,
        height: 276,
        fill: "#1f4bd8",
        cursor: "crosshair",
      }}
      onMouseMove={(event) =>
        trail.update((points) => [...points.slice(-17), [event.x, event.y]])
      }
    />,
    ...trail.get().map(([x, y], index) => (
      <Rectangle
        style={{
          left: x - 5,
          top: y - 5,
          width: 10,
          height: 10,
          fill: index === trail.get().length - 1 ? "#f7c948" : "#74d3ae",
          opacity: (index + 3) / (trail.get().length + 2),
        }}
      />
    )),
    <Text
      style={{
        left: 360,
        top: 368,
        fill: "#17211d",
        font: "800 15px monospace",
        textAlign: "center",
      }}
    >
      {trail.get().length
        ? `${Math.round(trail.get().at(-1)![0])}, ${Math.round(trail.get().at(-1)![1])}`
        : "MOVE INSIDE THE FIELD"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <MouseMoveStudy />);
}
