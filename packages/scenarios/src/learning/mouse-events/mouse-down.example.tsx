import { pibbl, useSignal, Rectangle, Text, type PibblController } from "@pibbl/core";
function MouseDownStudy() {
  const presses = useSignal(0);
  const button = useSignal("none");
  return [
    <Rectangle
      style={{
        left: 0,
        top: 0,
        width: 720,
        height: 420,
        fill: "#ff6b57",
      }}
    />,
    <Rectangle
      style={{
        left: 150,
        top: 92,
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
        left: 360,
        top: 164,
        fill: "#fffdf6",
        font: "900 40px sans-serif",
        textAlign: "center",
      }}
    >
      {"PRESS THE PAD"}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 238,
        fill: "#fffdf6",
        font: "700 15px monospace",
        textAlign: "center",
      }}
    >{`DOWN / ${presses.get()} / ${button.get()}`}</Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <MouseDownStudy />);
}
