import { crc, useSignal, Rectangle, Text, type CRCController } from "@crc/core";
function MouseOverStudy() {
  const active = useSignal("none");
  const card = (x: number, color: string, label: string) => [
    <Rectangle
      style={{
        left: x,
        top: 108,
        width: 176,
        height: 210,
        fill: color,
        stroke: "#17211d",
        strokeWidth: 5,
        cursor: "pointer",
      }}
      onMouseOver={() => active.set(label)}
    />,
    <Text
      style={{
        left: x + 88,
        top: 196,
        fill: "#17211d",
        font: "900 22px sans-serif",
        textAlign: "center",
      }}
    >
      {label}
    </Text>,
  ];
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
    ...card(64, "#1f4bd8", "FORM"),
    ...card(272, "#ff6b57", "COLOR"),
    ...card(480, "#f7c948", "PLAY"),
    <Text
      style={{
        left: 360,
        top: 352,
        fill: "#17211d",
        font: "800 15px monospace",
        textAlign: "center",
      }}
    >
      {active.get() === "none" ? "ENTER A CARD" : `${active.get()} / ENTERED`}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <MouseOverStudy />);
}
