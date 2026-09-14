import { crc, Rectangle, Text, type CRCController } from "@crc/core";

function DiagramEditor() {
  return [
    <Rectangle style={{ width: 960, height: 56, fill: "#fffdf6" }} />,
    <Text
      pointerEvents="none"
      style={{ x: 24, y: 34, fill: "#17211d", font: "900 22px sans-serif" }}
    >
      WORKFLOW MAP
    </Text>,
    <Rectangle
      style={{ x: 0, y: 56, width: 960, height: 512, fill: "#eef2e8" }}
    />,
    <Text
      pointerEvents="none"
      style={{
        x: 480,
        y: 310,
        fill: "#66736b",
        font: "700 16px monospace",
        textAlign: "center",
      }}
    >
      YOUR DIAGRAM STARTS HERE
    </Text>,
    <Rectangle
      style={{ x: 0, y: 568, width: 960, height: 32, fill: "#17211d" }}
    />,
    <Text
      pointerEvents="none"
      style={{ x: 20, y: 589, fill: "#fffdf6", font: "700 12px monospace" }}
    >
      READY · 100%
    </Text>,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <DiagramEditor />);
}
