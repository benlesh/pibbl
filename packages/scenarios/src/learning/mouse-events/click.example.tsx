import { crc, useSignal, Rectangle, Text, type CRCController } from "@crc/core";
function ClickStudy() {
  const picks = useSignal(0);
  const sleeve = (x: number, color: string, value: number) => (
    <Rectangle
      style={{
        left: x,
        top: 118,
        width: 160,
        height: 190,
        fill: color,
        stroke: "#17211d",
        strokeWidth: 5,
        cursor: "pointer",
      }}
      onClick={() => picks.update((total) => total + value)}
    />
  );
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
    <Text
      style={{
        left: 360,
        top: 54,
        fill: "#17211d",
        font: "900 28px sans-serif",
        textAlign: "center",
      }}
    >{`RECORD PICKS / ${picks.get()}`}</Text>,
    sleeve(86, "#1f4bd8", 1),
    sleeve(280, "#ff6b57", 1),
    sleeve(474, "#f7c948", 1),
    <Text
      style={{
        left: 360,
        top: 342,
        fill: "#17211d",
        font: "700 14px monospace",
        textAlign: "center",
      }}
    >
      {"CLICK A SLEEVE"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <ClickStudy />);
}
