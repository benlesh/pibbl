import { crc, useState, Rectangle, Text, type CRCController } from "@crc/core";
function RectangleStudy() {
  const [hovered, setHovered] = useState(false);
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#f7f0df",
      }}
    />,
    <Rectangle
      style={{
        x: 54,
        y: 52,
        width: 252,
        height: 316,
        fill: "#1f4bd8",
        cornerRadius: 28,
      }}
    />,
    <Rectangle
      style={{
        x: 268,
        y: 104,
        width: 280,
        height: 190,
        fill: hovered ? "#74d3ae" : "#ff6b57",
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "crosshair",
        cornerRadii: [32, 8, 32, 8],
      }}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    />,
    <Rectangle
      style={{
        x: 534,
        y: 50,
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
        x: 406,
        y: 292,
        width: 260,
        height: 76,
        stroke: "#17211d",
        strokeWidth: 6,
      }}
    />,
    <Text
      style={{
        x: 536,
        y: 330,
        fill: "#17211d",
        font: "800 16px sans-serif",
        textAlign: "center",
        textBaseline: "middle",
      }}
    >
      {hovered ? "TARGET FOUND" : "RECTANGLE STUDY"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <RectangleStudy />);
}
