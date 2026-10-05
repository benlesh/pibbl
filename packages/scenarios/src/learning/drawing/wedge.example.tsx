import { pibbl, useSignal, Rectangle, Wedge, type PibblController } from "@pibbl/core";

function WedgeStudy() {
  const active = useSignal(false);

  return [
    <Rectangle
      style={{ left: 0, top: 0, width: 720, height: 420, fill: "#f7f0df" }}
    />,
    <Wedge
      style={{
        cx: 360,
        cy: 210,
        radius: 132,
        startAngle: -Math.PI / 2,
        endAngle: Math.PI / 3,
        fill: active.get() ? "#22c55e" : "#a855f7",
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "pointer",
      }}
      onClick={() => active.update((value) => !value)}
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <WedgeStudy />);
}
