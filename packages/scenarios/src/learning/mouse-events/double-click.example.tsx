import { crc, useState, Rectangle, Text, type CRCController } from "@crc/core";
function DoubleClickStudy() {
  const [stamps, setStamps] = useState(0);
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#1f4bd8",
      }}
    />,
    <Rectangle
      style={{
        x: 190,
        y: 76,
        width: 340,
        height: 268,
        fill: "#f7c948",
        stroke: "#17211d",
        strokeWidth: 7,
        cursor: "copy",
      }}
      onDblClick={() => setStamps((value) => value + 1)}
    />,
    <Text
      style={{
        x: 360,
        y: 166,
        fill: "#17211d",
        font: "900 42px sans-serif",
        textAlign: "center",
      }}
    >
      {stamps ? `STAMPED × ${stamps}` : "DOUBLE CLICK"}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 236,
        fill: "#17211d",
        font: "700 14px monospace",
        textAlign: "center",
      }}
    >
      {"A SECONDARY GESTURE"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <DoubleClickStudy />);
}
