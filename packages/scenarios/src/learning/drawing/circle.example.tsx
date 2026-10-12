import { Circle, pibbl, useSignal, Rectangle, type PibblController } from "@pibbl/core";

function CircleStudy() {
  const active = useSignal(false);

  return [
    <Rectangle
      style={{ left: 0, top: 0, width: 720, height: 420, fill: "#f7f0df" }}
    />,
    <Circle
      style={{
        cx: 360,
        cy: 210,
        radius: 110,
        fill: active.get() ? "#74d3ae" : "#ff6b57",
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "pointer",
      }}
      onClick={() => active.update((value) => !value)}
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <CircleStudy />);
}
