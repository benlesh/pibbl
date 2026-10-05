import { pibbl, useSignal, Rectangle, Text, type PibblController } from "@pibbl/core";
function MouseUpStudy() {
  const releases = useSignal(0);
  const position = useSignal("—");
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
        left: 166,
        top: 82,
        width: 388,
        height: 256,
        fill: "#f7c948",
        stroke: "#17211d",
        strokeWidth: 7,
        cursor: "pointer",
      }}
      onMouseUp={(event) => {
        releases.update((value) => value + 1);
        position.set(`${Math.round(event.x)}, ${Math.round(event.y)}`);
      }}
    />,
    <Text
      style={{
        left: 360,
        top: 162,
        fill: "#17211d",
        font: "900 40px sans-serif",
        textAlign: "center",
      }}
    >
      {"RELEASE HERE"}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 236,
        fill: "#17211d",
        font: "700 15px monospace",
        textAlign: "center",
      }}
    >{`UP / ${releases.get()} / ${position.get()}`}</Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <MouseUpStudy />);
}
