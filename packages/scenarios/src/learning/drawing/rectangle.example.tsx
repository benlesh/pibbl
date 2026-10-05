import { pibbl, useSignal, Rectangle, Text, type PibblController } from "@pibbl/core";
function RectangleStudy() {
  const hovered = useSignal(false);
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
        left: 54,
        top: 52,
        width: 252,
        height: 316,
        fill: "#1f4bd8",
        cornerRadius: 28,
      }}
    />,
    <Rectangle
      style={{
        left: 268,
        top: 104,
        width: 280,
        height: 190,
        fill: hovered.get() ? "#74d3ae" : "#ff6b57",
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "crosshair",
        cornerRadii: [32, 8, 32, 8],
      }}
      onMouseOver={() => hovered.set(true)}
      onMouseOut={() => hovered.set(false)}
    />,
    <Rectangle
      style={{
        left: 534,
        top: 50,
        width: 132,
        height: 132,
        fill: "#f7c948",
        stroke: "#17211d",
        strokeWidth: 2,
        alignToPixelGrid: "round",
      }}
    />,
    <Rectangle
      style={{
        left: 406,
        top: 292,
        width: 260,
        height: 76,
        stroke: "#17211d",
        strokeWidth: 6,
      }}
    />,
    <Text
      style={{
        left: 536,
        top: 330,
        fill: "#17211d",
        font: "800 16px sans-serif",
        textAlign: "center",
        textBaseline: "middle",
      }}
    >
      {hovered.get() ? "TARGET FOUND" : "RECTANGLE STUDY"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <RectangleStudy />);
}
