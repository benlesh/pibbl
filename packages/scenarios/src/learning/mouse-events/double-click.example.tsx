import { pibbl, useSignal, Rectangle, Text, type PibblController } from "@pibbl/core";
function DoubleClickStudy() {
  const stamps = useSignal(0);
  return [
    <Rectangle
      style={{
        left: 0,
        top: 0,
        width: 720,
        height: 420,
        fill: "#1f4bd8",
      }}
    />,
    <Rectangle
      style={{
        left: 190,
        top: 76,
        width: 340,
        height: 268,
        fill: "#f7c948",
        stroke: "#17211d",
        strokeWidth: 7,
        cursor: "copy",
      }}
      onDblClick={() => stamps.update((value) => value + 1)}
    />,
    <Text
      style={{
        left: 360,
        top: 166,
        fill: "#17211d",
        font: "900 42px sans-serif",
        textAlign: "center",
      }}
    >
      {stamps.get() ? `STAMPED × ${stamps.get()}` : "DOUBLE CLICK"}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 236,
        fill: "#17211d",
        font: "700 14px monospace",
        textAlign: "center",
      }}
    >
      {"A SECONDARY GESTURE"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <DoubleClickStudy />);
}
