import { pibbl, useSignal, Ellipse, Rectangle, type PibblController } from "@pibbl/core";

function EllipseStudy() {
  const active = useSignal(false);

  return [
    <Rectangle
      style={{ left: 0, top: 0, width: 720, height: 420, fill: "#f7f0df" }}
    />,
    <Ellipse
      style={{
        cx: 360,
        cy: 210,
        radiusX: 154,
        radiusY: 78,
        rotation: -0.22,
        fill: active.get() ? "#f7c948" : "#1f4bd8",
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "pointer",
      }}
      onClick={() => active.update((value) => !value)}
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <EllipseStudy />);
}
