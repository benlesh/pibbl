import { crc, useState, Rectangle, Text, type CRCController } from "@crc/core";
function MouseUpStudy() {
  const [releases, setReleases] = useState(0);
  const [position, setPosition] = useState("—");
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
        x: 166,
        y: 82,
        width: 388,
        height: 256,
        fill: "#f7c948",
        stroke: "#17211d",
        strokeWidth: 7,
        cursor: "pointer",
      }}
      onMouseUp={(event) => {
        setReleases((value) => value + 1);
        setPosition(`${Math.round(event.x)}, ${Math.round(event.y)}`);
      }}
    />,
    <Text
      style={{
        x: 360,
        y: 162,
        fill: "#17211d",
        font: "900 40px sans-serif",
        textAlign: "center",
      }}
    >
      {"RELEASE HERE"}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 236,
        fill: "#17211d",
        font: "700 15px monospace",
        textAlign: "center",
      }}
    >{`UP / ${releases} / ${position}`}</Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <MouseUpStudy />);
}
