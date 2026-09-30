import { Arc, crc, useSignal, Rectangle, type CRCController } from "@crc/core";

function ArcStudy() {
  const active = useSignal(false);

  return [
    <Rectangle
      style={{ left: 0, top: 0, width: 720, height: 420, fill: "#f7f0df" }}
    />,
    <Arc
      style={{
        cx: 360,
        cy: 210,
        radius: 120,
        startAngle: -Math.PI,
        endAngle: 0,
        stroke: active.get() ? "#ff6b57" : "#1f4bd8",
        strokeWidth: 14,
        lineInteractionWidth: 34,
        cursor: "pointer",
      }}
      onClick={() => active.update((value) => !value)}
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <ArcStudy />);
}
