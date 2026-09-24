import { crc, useSignal, Rectangle, Text, type CRCController } from "@crc/core";
function MouseDownStudy() {
  const presses = useSignal(0);
  const button = useSignal("none");
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#ff6b57",
      }}
    />,
    <Rectangle
      style={{
        x: 150,
        y: 92,
        width: 420,
        height: 236,
        fill: "#1f4bd8",
        stroke: "#17211d",
        strokeWidth: 8,
        cursor: "pointer",
      }}
      onMouseDown={(event) => {
        presses.update((value) => value + 1);
        button.set(["primary", "middle", "secondary"][event.originalEvent.button] ??
            `button ${event.originalEvent.button}`);
      }}
    />,
    <Text
      style={{
        x: 360,
        y: 164,
        fill: "#fffdf6",
        font: "900 40px sans-serif",
        textAlign: "center",
      }}
    >
      {"PRESS THE PAD"}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 238,
        fill: "#fffdf6",
        font: "700 15px monospace",
        textAlign: "center",
      }}
    >{`DOWN / ${presses.get()} / ${button.get()}`}</Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <MouseDownStudy />);
}
